import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import AdmZip from 'adm-zip';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import type { ProcessFrameZipJob } from '../jobs/bullmq.constants';
import {
  MAX_DIMENSION,
  SIZES,
  STATUS_FAILED,
  STATUS_PROCESSING,
  STATUS_READY,
  durableContentUrl,
  publicOrAssetUrl,
} from './media-status';
import { markMediaFailed } from './image-pipeline';
import { encodeWebp, heapMb, MAX_SINGLE_FRAME, MAX_ZIP_BYTES, readImageMeta } from './sharp-limits';

const logger = new Logger('ProcessFrameZip');
const FRAME_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const MAX_FILES = 200;
const NAT = /(\d+)/g;

function naturalSortKey(name: string): (string | number)[] {
  return name.toLowerCase().split(NAT).map((p) => ( /^\d+$/.test(p) ? Number(p) : p ));
}

async function updateJob(
  prisma: PrismaService,
  jobTaskId: number,
  data: { status?: string; result?: any; error_message?: string | null; completed?: boolean },
) {
  await prisma.media_task.update({
    where: { id: jobTaskId },
    data: {
      ...(data.status ? { status: data.status } : {}),
      ...(data.result !== undefined
        ? { result: typeof data.result === 'string' ? data.result : JSON.stringify(data.result) }
        : {}),
      ...(data.error_message !== undefined ? { error_message: data.error_message?.slice(0, 2000) } : {}),
      ...(data.completed ? { completed_at: new Date() } : {}),
      updated_at: new Date(),
    },
  });
}

async function processFrameBuffer(
  prisma: PrismaService,
  storage: StorageService,
  storeId: number,
  uploadedBy: number | null | undefined,
  fileName: string,
  raw: Buffer,
) {
  const bucket = storage.getBucketName();
  const asset = await prisma.media_asset.create({
    data: {
      store_id: storeId,
      file_name: (fileName || 'frame.jpg').slice(0, 255),
      mime_type: 'image/jpeg',
      file_size: raw.length,
      status: STATUS_PROCESSING,
      bucket_name: bucket,
      uploaded_by: uploadedBy || null,
      original_size: raw.length,
      file_type: 'frame_sequence',
      tags: { hidden_from_library: true, purpose: 'frame_sequence' },
      created_at: new Date(),
      updated_at: new Date(),
      last_scanned_at: new Date(),
    },
  });
  const durable = durableContentUrl(asset.id);
  try {
    const meta = await readImageMeta(raw);
    const width = meta.width || 0;
    const height = meta.height || 0;
    if (width < 1 || height < 1 || width > MAX_DIMENSION || height > MAX_DIMENSION) {
      throw new Error(`Invalid image dimensions: ${width}x${height}`);
    }
    const optimized = await encodeWebp(raw, undefined, 85);
    const keys: Record<string, string> = {};
    let total = 0;
    const variants: Array<[string, Buffer]> = [['optimized', optimized]];
    for (const name of ['thumbnail', 'medium', 'large'] as const) {
      variants.push([name, await encodeWebp(optimized, SIZES[name], SIZES[name].quality)]);
    }
    for (const [name, buf] of variants) {
      total += buf.length;
      const key = `stores/${storeId}/media/${asset.id}/${name}.webp`;
      await storage.uploadFile(buf, key, 'image/webp');
      keys[name] = storage.toR2Uri(key);
    }
    const originalHttp = publicOrAssetUrl(keys.optimized, asset.id, 'optimized');
    const thumbHttp = publicOrAssetUrl(keys.thumbnail, asset.id, 'thumbnail');
    await prisma.media_asset.updateMany({
      where: { id: asset.id, store_id: storeId },
      data: {
        status: STATUS_READY,
        file_size: total,
        width,
        height,
        r2_object_key: keys.optimized,
        bucket_name: bucket,
        responsive_keys: {
          thumbnail: keys.thumbnail,
          medium: keys.medium,
          large: keys.large,
          optimized: keys.optimized,
        },
        thumbnail_keys: { small: keys.thumbnail },
        original_url: originalHttp,
        thumbnail_url: thumbHttp,
        webp_url: originalHttp,
        r2_optimized_key: keys.optimized,
        r2_thumbnail_key: keys.thumbnail,
        r2_medium_key: keys.medium,
        r2_large_key: keys.large,
        error_message: null,
        optimized_size: total,
        mime_type: 'image/webp',
        updated_at: new Date(),
      },
    });
    return {
      id: asset.id,
      status: STATUS_READY,
      url: durable,
      file_name: fileName,
      width,
      height,
    };
  } catch (e) {
    await markMediaFailed(prisma, asset.id, storeId, (e as Error).message);
    return {
      id: asset.id,
      status: STATUS_FAILED,
      url: null,
      file_name: fileName,
      error: String((e as Error).message).slice(0, 500),
    };
  }
}

export async function processFrameZipJob(
  prisma: PrismaService,
  storage: StorageService,
  payload: ProcessFrameZipJob,
  attempt: number,
  maxAttempts: number,
) {
  const { source, jobTaskId, storeId, uploadedBy } = payload;
  if (!jobTaskId || !storeId) throw new Error('job_task_id and store_id are required');

  const resultBase: any = {
    phase: 'starting',
    total: 0,
    processed: 0,
    failed: 0,
    assets: [],
    file_name: null,
  };
  const assetsOut: any[] = [];
  let failed = 0;
  let localZip: string | null = null;

  try {
    await updateJob(prisma, jobTaskId, {
      status: STATUS_PROCESSING,
      result: { ...resultBase, phase: 'downloading' },
    });

    localZip = path.join(os.tmpdir(), `frames-${jobTaskId}-${Date.now()}.zip`);
    const saved = await storage.downloadToFile(source, localZip, MAX_ZIP_BYTES);
    if (!saved) throw new Error('Failed to download ZIP from storage');
    logger.log(`zip job=${jobTaskId} rss=${heapMb()}mb`);

    const zip = new AdmZip(localZip);
    const members = zip
      .getEntries()
      .filter((e) => {
        if (e.isDirectory) return false;
        const name = e.entryName.replace(/\\/g, '/');
        const base = path.basename(name);
        if (!base || base.startsWith('.') || name.startsWith('__MACOSX')) return false;
        const ext = path.extname(base).toLowerCase();
        if (!FRAME_EXTS.has(ext)) return false;
        if ((e.header?.size || 0) > MAX_SINGLE_FRAME) {
          throw new Error(`Frame too large in ZIP: ${base}`);
        }
        return true;
      })
      .sort((a, b) => {
        const ka = naturalSortKey(path.basename(a.entryName));
        const kb = naturalSortKey(path.basename(b.entryName));
        const n = Math.max(ka.length, kb.length);
        for (let i = 0; i < n; i++) {
          if (ka[i] === kb[i]) continue;
          if (ka[i] == null) return -1;
          if (kb[i] == null) return 1;
          return ka[i] < kb[i] ? -1 : 1;
        }
        return 0;
      });

    if (!members.length) throw new Error('ZIP contains no supported images (jpg/png/webp/avif)');
    if (members.length > MAX_FILES) throw new Error(`ZIP has too many frames (max ${MAX_FILES})`);

    resultBase.total = members.length;
    resultBase.phase = 'processing';
    await updateJob(prisma, jobTaskId, { result: { ...resultBase, assets: assetsOut } });

    for (let idx = 0; idx < members.length; idx++) {
      const entry = members[idx];
      const base = path.basename(entry.entryName.replace(/\\/g, '/'));
      const raw = entry.getData();
      const asset = await processFrameBuffer(prisma, storage, storeId, uploadedBy, base, raw);
      assetsOut.push(asset);
      if (asset.status !== STATUS_READY) failed += 1;
      resultBase.processed = idx + 1;
      resultBase.failed = failed;
      resultBase.assets = assetsOut;
      if ((idx + 1) % 5 === 0 || idx + 1 === members.length) {
        await updateJob(prisma, jobTaskId, { result: { ...resultBase } });
      }
    }

    const readyUrls = assetsOut.filter((a) => a.status === STATUS_READY && a.url).map((a) => a.url);
    const finalStatus = readyUrls.length ? STATUS_READY : STATUS_FAILED;
    resultBase.phase = readyUrls.length ? 'done' : 'failed';
    resultBase.frame_urls = readyUrls;
    resultBase.assets = assetsOut;
    await updateJob(prisma, jobTaskId, {
      status: finalStatus,
      result: resultBase,
      error_message: readyUrls.length ? null : 'No frames processed successfully',
      completed: true,
    });

    if (localZip && fs.existsSync(localZip)) fs.unlinkSync(localZip);
    await storage.deleteFile(source);

    return {
      status: readyUrls.length ? 'success' : 'failed',
      job_task_id: jobTaskId,
      total: resultBase.total,
      ready: readyUrls.length,
      failed,
    };
  } catch (e) {
    logger.error(`process_frame_zip failed job=${jobTaskId}: ${(e as Error).message}`);
    if (attempt >= maxAttempts) {
      resultBase.phase = 'failed';
      resultBase.assets = assetsOut;
      resultBase.failed = failed + 1;
      await updateJob(prisma, jobTaskId, {
        status: STATUS_FAILED,
        result: resultBase,
        error_message: (e as Error).message,
        completed: true,
      });
      if (localZip && fs.existsSync(localZip)) {
        try {
          fs.unlinkSync(localZip);
        } catch {
          /* ignore */
        }
      }
      await storage.deleteFile(source).catch(() => undefined);
    }
    throw e;
  }
}
