import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/**
 * Prisma over a tuned pg pool for remote Aiven/Postgres.
 * - Modest max sockets so managed plans do not reject new connections.
 * - keepAlive prevents idle NAT/firewall drops that leave zombie pool clients.
 * - connectionTimeoutMillis fails fast instead of hanging the request ~10s+.
 * - statement_timeout kills runaway queries so sockets return to the pool.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private slowQueryCount = 0;
  private readonly pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL || '';
    const max = Math.max(1, Math.min(parseInt(process.env.PG_POOL_MAX || '2', 10) || 2, 8));
    const connectionTimeoutMillis = Math.max(
      2000,
      parseInt(process.env.PG_CONNECT_TIMEOUT_MS || '5000', 10) || 5000,
    );
    const statementTimeout = Math.max(
      5000,
      parseInt(process.env.PG_STATEMENT_TIMEOUT_MS || '20000', 10) || 20000,
    );

    // Aiven / managed PG almost always needs TLS. Prefer URL sslmode when set;
    // otherwise enable TLS for non-local hosts.
    let ssl: false | { rejectUnauthorized: boolean } = false;
    try {
      const u = new URL(connectionString);
      const host = (u.hostname || '').toLowerCase();
      const sslMode = (u.searchParams.get('sslmode') || '').toLowerCase();
      const isLocal = host === 'localhost' || host === '127.0.0.1';
      if (!isLocal || sslMode === 'require' || sslMode === 'verify-full' || sslMode === 'verify-ca') {
        ssl = { rejectUnauthorized: false };
      }
    } catch {
      if (connectionString.includes('sslmode=require') || connectionString.includes('aivencloud.com')) {
        ssl = { rejectUnauthorized: false };
      }
    }

    const pool = new Pool({
      connectionString,
      max,
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      options: `-c statement_timeout=${statementTimeout}`,
      ...(ssl ? { ssl } : {}),
    });

    pool.on('error', (err) => {
      // Idle client errors must not crash the process — log and let the pool replace.
      this.logger.warn(`pg pool client error: ${err?.message || err}`);
    });

    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;

    this.logger.log(
      `Postgres pool ready (max=${max}, connectTimeout=${connectionTimeoutMillis}ms, statementTimeout=${statementTimeout}ms, ssl=${Boolean(ssl)})`,
    );
  }

  getSlowQueryCount() {
    return this.slowQueryCount;
  }

  resetSlowQueryCount() {
    const prev = this.slowQueryCount;
    this.slowQueryCount = 0;
    return prev;
  }

  /** Live pool stats for /api/internal/perf */
  getPoolStats() {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }

  async onModuleInit() {
    // Soft connect — do not crash boot if DB is briefly unreachable.
    try {
      await this.$connect();
    } catch (err: any) {
      this.logger.error(`Prisma initial connect failed: ${err?.message || err}`);
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
    } catch {
      /* ignore */
    }
    try {
      await this.pool.end();
    } catch {
      /* ignore */
    }
  }
}
