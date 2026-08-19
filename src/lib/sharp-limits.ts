import sharp from 'sharp';

export const INPUT_PIXELS = 16_000_000;
export const PROCESS_MAX = 2048;
export const WEBP_EFFORT = 2;
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
export const MAX_ZIP_BYTES = 200 * 1024 * 1024;
export const MAX_SINGLE_FRAME = 8 * 1024 * 1024;

export function configureSharp() {
  sharp.cache(false);
  sharp.concurrency(Math.max(1, parseInt(process.env.SHARP_CONCURRENCY || '1', 10) || 1));
}

export async function encodeWebp(
  input: Buffer,
  size?: { w: number; h: number },
  quality = 80,
): Promise<Buffer> {
  const img = sharp(input, {
    failOn: 'error',
    limitInputPixels: INPUT_PIXELS,
    sequentialRead: true,
  })
    .rotate()
    .flatten({ background: { r: 255, g: 255, b: 255 } });
  if (size) img.resize(size.w, size.h, { fit: 'inside', withoutEnlargement: true });
  else img.resize(PROCESS_MAX, PROCESS_MAX, { fit: 'inside', withoutEnlargement: true });
  try {
    return await img.webp({ quality, effort: WEBP_EFFORT }).toBuffer();
  } finally {
    img.destroy();
  }
}

export async function readImageMeta(input: Buffer) {
  const img = sharp(input, {
    failOn: 'error',
    limitInputPixels: INPUT_PIXELS,
    sequentialRead: true,
  }).rotate();
  try {
    return await img.metadata();
  } finally {
    img.destroy();
  }
}

export function heapMb() {
  return Math.round(process.memoryUsage().rss / 1024 / 1024);
}
