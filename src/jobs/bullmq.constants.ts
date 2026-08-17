/** Celery routed every media_worker.tasks.* job onto media_queue. Keep that name. */
export const BULLMQ_MEDIA_QUEUE = 'media_queue';

export const BULLMQ_JOB = {
  PROCESS_IMAGE: 'process_image',
  PROCESS_FRAME_ZIP: 'process_frame_zip',
  CLEANUP_TEMP_FILE: 'cleanup_temp_file',
  SEND_OTP_EMAIL: 'send_otp_email',
  SEND_EMAIL: 'send_email',
  DELETE_STORE_ACCOUNT: 'delete_store_account',
  SEED_DEFAULT_STORE_DATA: 'seed_default_store_data',
  ABANDONED_CHECKOUT: 'abandoned_checkout',
} as const;

export type BullmqJobName = (typeof BULLMQ_JOB)[keyof typeof BULLMQ_JOB];

export interface ProcessImageJob {
  source: string;
  assetId: number;
  originalName: string;
  mimeType: string;
  storeId: number;
}

export interface ProcessFrameZipJob {
  source: string;
  jobTaskId: number;
  storeId: number;
  uploadedBy?: number | null;
}

export interface CleanupTempFileJob {
  source?: string | null;
  localPath?: string | null;
}

export interface SendOtpEmailJob {
  to: string;
  otp: string;
  storeId?: number | null;
}

export interface SendEmailJob {
  to: string;
  subject: string;
  bodyHtml: string;
}

export interface DeleteStoreAccountJob {
  storeId: number;
  userId: number;
}

export interface SeedStoreJob {
  storeId: number;
}

export interface AbandonedCheckoutJob {
  storeId: number;
  email: string;
  name?: string;
}
