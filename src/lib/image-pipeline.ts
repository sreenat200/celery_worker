import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import type { ProcessImageJob } from '../jobs/bullmq.constants';
import {
  MAX_DIMENSION,
  SIZES,
  STATUS_DELETED,
  STATUS_FAILED,
  STATUS_PROCESSING,
  STATUS_READY,
  publicOrAssetUrl,
} from './media-status';
import { encodeWebp, heapMb, MAX_SOURCE_BYTES, readImageMeta } from './sharp-limits';

const logger = new Logger('ProcessImage');

export async function markMediaFailed(
  prisma: PrismaService,
  assetId: number,
  storeId: number | string | null,
  errorMessage: string,
) {
  const msg = (errorMessage || 'Processing failed').slice(0, 2000);
  const sid = storeId != null && String(storeId) !== 'global' ? Number(storeId) : null;
  try {
    if (sid) {
      await prisma.media_asset.updateMany({
        where: { id: assetId, store_id: sid, NOT: { status: STATUS_DELETED } },
        data: { status: STATUS_FAILED, error_message: msg, updated_at: new Date() },
      });
    } else {
      await prisma.media_asset.updateMany({
        where: { id: assetId, NOT: { status: STATUS_DELETED } },
        data: { status: STATUS_FAILED, error_message: msg, updated_at: new Date() },
      });
    }
    await prisma.media_task.updateMany({
      where: { media_id: assetId, status: STATUS_PROCESSING },
      data: {
        status: STATUS_FAILED,
        error_message: msg,
        completed_at: new Date(),
        updated_at: new Date(),
      },
    });
  } catch (e) {
    logger.error(`Failed to mark media ${assetId} as failed: ${(e as Error).message}`);
  }
}

export async function processImageJob(
  prisma: PrismaService,
  storage: StorageService,
  payload: ProcessImageJob,
  attempt: number,
  maxAttempts: number,
) {
  const { source, assetId, storeId } = payload;
  let resolvedStoreId: number | string = storeId ?? 'global';
  const bucketName = storage.getBucketName();

  const asset =
    storeId && storeId > 0
      ? await prisma.media_asset.findFirst({ where: { id: assetId, store_id: storeId } })
      : await prisma.media_asset.findFirst({ where: { id: assetId } });

  if (!asset) {
    throw new Error(`Media asset ${assetId} not found for store ${resolvedStoreId}`);
  }

  const statusL = (asset.status || '').toLowerCase();
  if (statusL === STATUS_DELETED || statusL === 'deleted') {
    logger.log(`Skipping deleted media ${assetId}`);
    return { status: 'skipped', reason: 'deleted', asset_id: assetId };
  }

  if ((statusL === STATUS_READY || statusL === 'completed' || statusL === 'ready') && asset.r2_optimized_key) {
    await storage.deleteFile(source);
    logger.log(`Skipping already-ready media ${assetId} (idempotent)`);
    return { status: 'success', asset_id: assetId, idempotent: true };
  }

  if (asset.store_id && String(resolvedStoreId) === 'global') {
    resolvedStoreId = asset.store_id;
  }

  await prisma.media_asset.updateMany({
    where: {
      id: assetId,
      ...(typeof resolvedStoreId === 'number' ? { store_id: resolvedStoreId } : {}),
      NOT: { status: STATUS_DELETED },
    },
    data: { status: STATUS_PROCESSING, error_message: null, updated_at: new Date() },
  });

  const downloaded = await storage.getObjectBuffer(source);
  if (!downloaded?.buffer?.length) {
    throw new Error(`Failed to load source for media ${assetId}`);
  }
  if (downloaded.buffer.length > MAX_SOURCE_BYTES) {
    throw new Error(`Source too large (${downloaded.buffer.length} bytes)`);
  }

  try {
    logger.log(`process media=${assetId} src=${downloaded.buffer.length}b rss=${heapMb()}mb`);
    const meta = await readImageMeta(downloaded.buffer);
    const width = meta.width || 0;
    const height = meta.height || 0;
    if (width < 1 || height < 1 || width > MAX_DIMENSION || height > MAX_DIMENSION) {
      throw new Error(`Invalid image dimensions: ${width}x${height}`);
    }

    const optimized = await encodeWebp(downloaded.buffer, undefined, 85);
    downloaded.buffer = Buffer.alloc(0);

    const keys: Record<string, string> = {};
    let totalSize = 0;
    const variants: Array<[string, Buffer]> = [['optimized', optimized]];
    for (const name of ['thumbnail', 'medium', 'large'] as const) {
      variants.push([name, await encodeWebp(optimized, SIZES[name], SIZES[name].quality)]);
    }
    for (const [sizeName, buf] of variants) {
      totalSize += buf.length;
      const key = `stores/${resolvedStoreId}/media/${assetId}/${sizeName}.webp`;
      await storage.uploadFile(buf, key, 'image/webp');
      keys[sizeName] = storage.toR2Uri(key);
    }

    const r2Url = keys.optimized;
    const originalHttp = publicOrAssetUrl(r2Url, assetId, 'optimized');
    const thumbHttp = publicOrAssetUrl(keys.thumbnail, assetId, 'thumbnail');
    const responsiveKeys = {
      thumbnail: keys.thumbnail,
      medium: keys.medium,
      large: keys.large,
      optimized: keys.optimized,
    };

    const where =
      typeof resolvedStoreId === 'number'
        ? { id: assetId, store_id: resolvedStoreId, NOT: { status: STATUS_DELETED } }
        : { id: assetId, NOT: { status: STATUS_DELETED } };

    await prisma.media_asset.updateMany({
      where,
      data: {
        status: STATUS_READY,
        file_size: totalSize,
        width,
        height,
        r2_object_key: r2Url,
        bucket_name: bucketName,
        responsive_keys: responsiveKeys,
        thumbnail_keys: { small: keys.thumbnail },
        original_url: originalHttp,
        thumbnail_url: thumbHttp,
        webp_url: originalHttp,
        r2_optimized_key: keys.optimized,
        r2_thumbnail_key: keys.thumbnail,
        r2_medium_key: keys.medium,
        r2_large_key: keys.large,
        error_message: null,
        optimized_size: totalSize,
        updated_at: new Date(),
      },
    });

    await prisma.media_task.updateMany({
      where: { media_id: assetId, status: STATUS_PROCESSING },
      data: {
        status: STATUS_READY,
        result: JSON.stringify({ key: r2Url, sizes: Object.keys(keys) }),
        completed_at: new Date(),
        updated_at: new Date(),
        error_message: null,
      },
    });

    await storage.deleteFile(source);
    if (typeof resolvedStoreId === 'number') {
      await storage.deletePrefix(`stores/${resolvedStoreId}/media/${assetId}/temp/`);
    }

    return { status: 'success', asset_id: assetId, key: r2Url, store_id: resolvedStoreId };
  } catch (e) {
    logger.error(`process_image failed for media ${assetId}: ${(e as Error).message}`);
    if (attempt >= maxAttempts) {
      await markMediaFailed(prisma, assetId, resolvedStoreId, (e as Error).message);
    }
    throw e;
  }
}
