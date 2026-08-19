import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { Worker, type Job } from 'bullmq';
import { PrismaService } from './prisma/prisma.service';
import { StorageService } from './storage/storage.service';
import { createBullmqConnection } from './jobs/bullmq.connection';
import {
  BULLMQ_JOB,
  BULLMQ_MEDIA_QUEUE,
  type CleanupTempFileJob,
  type DeleteStoreAccountJob,
  type ProcessFrameZipJob,
  type ProcessImageJob,
  type SeedStoreJob,
  type AbandonedCheckoutJob,
  type AppWebhookJob,
  type WhatsappSendJob,
  type SendEmailJob,
  type SendOtpEmailJob,
} from './jobs/bullmq.constants';
import { processImageJob } from './lib/image-pipeline';
import { processFrameZipJob } from './lib/frame-zip';
import { seedDefaultStoreData } from './lib/seed-store';
import { deleteStoreAccount } from './lib/delete-store';
import { heapMb } from './lib/sharp-limits';

function out(msg: string) {
  process.stdout.write(`${new Date().toISOString()} [bullmq] ${msg}\n`);
}

function jobMeta(job: Job) {
  const d = (job.data || {}) as Record<string, unknown>;
  const bits = [
    d.storeId != null ? `store=${d.storeId}` : '',
    d.assetId != null ? `asset=${d.assetId}` : '',
    d.jobTaskId != null ? `task=${d.jobTaskId}` : '',
    d.to != null ? `to=${String(d.to)}` : '',
    d.topic != null ? `topic=${d.topic}` : '',
    d.source != null ? `source=${String(d.source).slice(-80)}` : '',
  ].filter(Boolean);
  return bits.join(' ');
}

@Injectable()
export class WorkerRunner implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('BullmqWorker');
  private readonly connection = createBullmqConnection();
  private worker: Worker | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly mailer: MailerService,
  ) {}

  onModuleInit() {
    const concurrency = Math.max(1, parseInt(process.env.WORKER_CONCURRENCY || '1', 10) || 1);
    const lockMs = Math.max(
      60_000,
      parseInt(process.env.WORKER_LOCK_DURATION_MS || String(20 * 60_000), 10) || 20 * 60_000,
    );

    this.worker = new Worker(
      BULLMQ_MEDIA_QUEUE,
      async (job) => this.dispatch(job),
      {
        connection: this.connection,
        concurrency,
        lockDuration: lockMs,
        stalledInterval: Math.min(lockMs, 60_000),
      },
    );

    this.worker.on('active', (job) => {
      out(`START id=${job.id} name=${job.name} attempt=${job.attemptsMade + 1} ${jobMeta(job)} rss=${heapMb()}mb`);
    });
    this.worker.on('completed', (job, result) => {
      const summary = result && typeof result === 'object' ? JSON.stringify(result).slice(0, 240) : '';
      out(`DONE  id=${job.id} name=${job.name} ${jobMeta(job)} rss=${heapMb()}mb ${summary}`);
    });
    this.worker.on('failed', (job, err) => {
      out(`FAIL  id=${job?.id} name=${job?.name} attempt=${(job?.attemptsMade || 0) + 1} ${err.message}`);
    });
    this.worker.on('stalled', (jobId) => {
      out(`STALL id=${jobId}`);
    });
    this.worker.on('error', (err) => {
      out(`ERROR ${err.message}`);
    });

    out(`listening queue=${BULLMQ_MEDIA_QUEUE} concurrency=${concurrency} lock=${lockMs}ms`);
  }

  async onModuleDestroy() {
    this.logger.log('Graceful worker shutdown…');
    await this.worker?.close();
  }

  private async dispatch(job: Job) {
    const attempts = job.opts.attempts || 1;
    const attempt = job.attemptsMade + 1;
    switch (job.name) {
      case BULLMQ_JOB.PROCESS_IMAGE:
        return processImageJob(
          this.prisma,
          this.storage,
          job.data as ProcessImageJob,
          attempt,
          attempts,
        );
      case BULLMQ_JOB.PROCESS_FRAME_ZIP:
        return processFrameZipJob(
          this.prisma,
          this.storage,
          job.data as ProcessFrameZipJob,
          attempt,
          attempts,
        );
      case BULLMQ_JOB.CLEANUP_TEMP_FILE: {
        const data = job.data as CleanupTempFileJob;
        if (data.source) await this.storage.deleteFile(data.source);
        return { status: 'cleaned' };
      }
      case BULLMQ_JOB.SEND_OTP_EMAIL:
        return this.sendOtp(job.data as SendOtpEmailJob);
      case BULLMQ_JOB.SEND_EMAIL:
        return this.sendEmail(job.data as SendEmailJob);
      case BULLMQ_JOB.DELETE_STORE_ACCOUNT: {
        const d = job.data as DeleteStoreAccountJob;
        return deleteStoreAccount(this.prisma, this.storage, d.storeId, d.userId);
      }
      case BULLMQ_JOB.SEED_DEFAULT_STORE_DATA: {
        const d = job.data as SeedStoreJob;
        return seedDefaultStoreData(this.prisma, this.storage, d.storeId);
      }
      case BULLMQ_JOB.ABANDONED_CHECKOUT: {
        const d = job.data as AbandonedCheckoutJob;
        return this.sendAbandoned(d);
      }
      case BULLMQ_JOB.APP_WEBHOOK:
        return this.deliverAppWebhook(job.data as AppWebhookJob);
      case BULLMQ_JOB.WHATSAPP_SEND:
        return this.sendWhatsapp(job.data as WhatsappSendJob);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }

  private async sendOtp(data: SendOtpEmailJob) {
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e4e4e7; border-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #18181b; font-size: 20px; font-weight: 700; margin-bottom: 8px; text-align: center;">One-Time Verification Code</h2>
      <p style="color: #71717a; font-size: 14px; text-align: center; margin-bottom: 24px;">Enter the code below to log in to your account. This code expires in 10 minutes.</p>
      <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; text-align: center; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #09090b; margin-bottom: 24px;">
        ${data.otp}
      </div>
      <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin: 0;">If you did not request this code, please ignore this email.</p>
    </div>`;
    await this.mailer.sendMail({
      to: data.to,
      subject: 'Your Verification Code',
      html,
    });
    return { status: 'success', to: data.to, store_id: data.storeId ?? null };
  }

  private async sendAbandoned(data: AbandonedCheckoutJob) {
    const settings = await this.prisma.site_settings.findFirst({
      where: { store_id: data.storeId },
      select: { notification_settings: true, site_name: true },
    });
    const n = settings?.notification_settings as any;
    if (n && n.abandoned_checkout !== true) {
      return { status: 'skipped', reason: 'disabled' };
    }
    const storeName = settings?.site_name || 'our store';
    await this.mailer.sendMail({
      to: data.email,
      subject: `You left items in your cart at ${storeName}`,
      html: `<p>Hi${data.name ? ` ${data.name}` : ''},</p><p>You left items in your cart at <strong>${storeName}</strong>. Come back to finish checkout whenever you're ready.</p>`,
    });
    return { status: 'sent', to: data.email };
  }

  private async sendEmail(data: SendEmailJob) {
    await this.mailer.sendMail({ to: data.to, subject: data.subject, html: data.bodyHtml });
    return { status: 'success' };
  }

  private async deliverAppWebhook(data: AppWebhookJob) {
    if (!data.targetUrl) return { status: 'skipped', reason: 'no_target' };
    const body = JSON.stringify({
      topic: data.topic,
      store_id: data.storeId,
      payload: data.payload,
    });
    const crypto = await import('crypto');
    const sig = data.secret
      ? crypto.createHmac('sha256', data.secret).update(body).digest('hex')
      : '';
    const res = await fetch(data.targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sig ? { 'X-App-Signature': sig } : {}),
      },
      body,
    });
    if (!res.ok) throw new Error(`webhook ${res.status}`);
    return { status: 'delivered', topic: data.topic };
  }

  private async sendWhatsapp(data: WhatsappSendJob) {
    const cfg = await this.prisma.whatsapp_config.findUnique({ where: { store_id: data.storeId } });
    if (!cfg?.phone_number || !cfg.api_key) {
      this.logger.log(`whatsapp_send skipped store=${data.storeId} (not configured)`);
      return { status: 'skipped' };
    }
    return { status: 'queued_external', to: data.to, storeId: data.storeId };
  }
}
