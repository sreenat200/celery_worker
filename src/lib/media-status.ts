export const STATUS_PROCESSING = 'processing';
export const STATUS_READY = 'ready';
export const STATUS_FAILED = 'failed';
export const STATUS_DELETED = 'deleted';

export const MAX_DIMENSION = 10000;
export const SIZES = {
  thumbnail: { w: 200, h: 200, quality: 80 },
  medium: { w: 800, h: 800, quality: 85 },
  large: { w: 1600, h: 1600, quality: 85 },
} as const;

export function durableContentUrl(assetId: number, variant?: string): string {
  const apiBase = (
    process.env.PUBLIC_API_URL ||
    process.env.API_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
  const q = variant && variant !== 'optimized' ? `?variant=${variant}` : '';
  return `${apiBase}/api/media/assets/${assetId}/content${q}`;
}

export function publicOrAssetUrl(r2Uri: string, assetId?: number, variant?: string): string {
  const publicBase = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
  if (publicBase && r2Uri.startsWith('r2://')) {
    const without = r2Uri.slice('r2://'.length);
    const slash = without.indexOf('/');
    const key = slash >= 0 ? without.slice(slash + 1) : '';
    if (key) return `${publicBase}/${key}`;
  }
  if (assetId != null) return durableContentUrl(assetId, variant);
  return r2Uri;
}
