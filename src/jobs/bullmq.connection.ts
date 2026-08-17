import type { ConnectionOptions } from 'bullmq';

/**
 * Valkey #1 — BullMQ broker only.
 * Never use APP_CACHE_REDIS_URL / VALKEY_CACHE_URL here (those are Valkey #2).
 */
export function getBullmqRedisUrl(): string {
  return (
    process.env.BULLMQ_REDIS_URL ||
    process.env.CELERY_BROKER_URL ||
    process.env.REDIS_URL ||
    'redis://localhost:6379/0'
  );
}

export function createBullmqConnection(): ConnectionOptions {
  const raw = getBullmqRedisUrl();
  const url = raw.replace(/^valkeys:\/\//, 'rediss://').replace(/^valkey:\/\//, 'redis://');
  const parsed = new URL(url);
  const dbPath = parsed.pathname.replace(/^\//, '');
  const tls = url.startsWith('rediss://');
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || (tls ? 6380 : 6379),
    username: parsed.username || undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db: dbPath ? parseInt(dbPath, 10) || 0 : 0,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    ...(tls ? { tls: { rejectUnauthorized: false } } : {}),
  };
}
