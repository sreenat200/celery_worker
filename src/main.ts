import { createServer } from 'http';
import { NestFactory } from '@nestjs/core';
import { WorkerAppModule } from './worker-app.module';
import { configureSharp, heapMb } from './lib/sharp-limits';

configureSharp();

function out(msg: string) {
  process.stdout.write(`${new Date().toISOString()} [bullmq] ${msg}\n`);
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerAppModule, {
    logger: ['log', 'error', 'warn'],
  });
  out(`started rss=${heapMb()}mb pid=${process.pid}`);

  const port = parseInt(process.env.PORT || '8080', 10);
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'media-worker', rssMb: heapMb() }));
  });
  await new Promise<void>((resolve) => server.listen(port, '0.0.0.0', resolve));
  out(`health listening on :${port}`);

  const beat = setInterval(() => out(`alive rss=${heapMb()}mb`), 60_000);
  beat.unref();

  const shutdown = async (signal: string) => {
    out(`shutdown ${signal}`);
    clearInterval(beat);
    server.close();
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error('Worker failed to start', err);
  process.exit(1);
});
