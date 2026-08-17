import sharp from 'sharp';
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

const logger = new Logger('ProcessImage');

async function optimizeWebp(input: Buffer, size?: { w: number; h: number }, quality = 85): Promise<Buffer> {
  let pipeline = sharp(input, { failOn: 'error', limitInputPixels: 40_000_000 }).rotate();
  const meta = await pipeline.metadata();
  if (meta.hasAlpha || meta.channels === 4) {
    pipeline = sharp(input, { failOn: 'error', limitInputPixels: 40_000_000 })
      .rotate()
      .flatten({ background: { r: 255, g: 255, b: 255 } });
  }
  if (size) {
    pipeline = pipeline.resize(size.w, size.h, { fit: 'inside', withoutEnlargement: true });
  }
  return pipeline.webp({ quality, effort: 4 }).toBuffer();
}

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

  try {
    const meta = await sharp(downloaded.buffer, {
      failOn: 'error',
      limitInputPixels: 40_000_000,
    })
      .rotate()
      .metadata();
    const width = meta.width || 0;
    const height = meta.height || 0;
    if (width < 1 || height < 1 || width > MAX_DIMENSION || height > MAX_DIMENSION) {
      throw new Error(`Invalid image dimensions: ${width}x${height}`);
    }

    const buffers: Record<string, Buffer> = {
      optimized: await optimizeWebp(downloaded.buffer, undefined, 85),
      thumbnail: await optimizeWebp(downloaded.buffer, SIZES.thumbnail, SIZES.thumbnail.quality),
      medium: await optimizeWebp(downloaded.buffer, SIZES.medium, SIZES.medium.quality),
      large: await optimizeWebp(downloaded.buffer, SIZES.large, SIZES.large.quality),
    };

    const keys: Record<string, string> = {};
    let totalSize = 0;
    for (const [sizeName, buf] of Object.entries(buffers)) {
      totalSize += buf.length;
      const key = `stores/${resolvedStoreId}/media/${assetId}/${sizeName}.webp`;
      await storage.uploadFile(buf, key, 'image/webp');
      keys[sizeName] = storage.toR2Uri(key);
    }

    try {
      const avif = await sharp(buffers.optimized).avif({ quality: 50 }).toBuffer();
      await storage.uploadFile(avif, `stores/${resolvedStoreId}/media/${assetId}/optimized.avif`, 'image/avif');
    } catch (avifErr) {
      logger.log(`AVIF encode skipped for media ${assetId}: ${(avifErr as Error).message}`);
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
