export const BULLMQ_MEDIA_QUEUE = 'media_queue';
export const AI_CONTENT_GENERATION_QUEUE = 'ai-content-generation';
export const PAGE_BUILDER_QUEUE = 'page-builder';

export const BULLMQ_JOB = {
  PROCESS_IMAGE: 'process_image',
  PROCESS_FRAME_ZIP: 'process_frame_zip',
  CLEANUP_TEMP_FILE: 'cleanup_temp_file',
  SEND_OTP_EMAIL: 'send_otp_email',
  SEND_EMAIL: 'send_email',
  DELETE_STORE_ACCOUNT: 'delete_store_account',
  SEED_DEFAULT_STORE_DATA: 'seed_default_store_data',
  ABANDONED_CHECKOUT: 'abandoned_checkout',
  APP_WEBHOOK: 'app_webhook',
  WHATSAPP_SEND: 'whatsapp_send',
  GENERATE_PRODUCT_DESCRIPTION: 'generate-product-description',
  GENERATE_COLLECTION_DESCRIPTION: 'generate-collection-description',
  GENERATE_PAGE_BLUEPRINT: 'generate-page-blueprint',
} as const;

export const AI_JOB = {
  GENERATE_PRODUCT_DESCRIPTION: 'generate-product-description',
  GENERATE_COLLECTION_DESCRIPTION: 'generate-collection-description',
  GENERATE_PAGE_BLUEPRINT: 'generate-page-blueprint',
} as const;

export const PAGE_BUILDER_JOB = {
  GENERATE_PAGE_BLUEPRINT: 'generate-page-blueprint',
  REFINE_PAGE_BLUEPRINT: 'refine-page-blueprint',
} as const;

export interface PageBuilderJobData {
  jobId: string;
  storeId: number;
  userId: number;
  userPrompt: string;
  themeId?: string | number | null;
  requestId?: string | null;
  followUpPrompt?: string;
  currentBlueprint?: PageBlueprint | null;
}

export interface GeneratedSectionBlock {
  id?: string;
  type?: string;
  settings?: Record<string, any>;
}

export interface GeneratedSectionInstance {
  id: string;
  type: string;
  title?: string;
  hidden?: boolean;
  style?: Record<string, any>;
  settings: Record<string, any>;
  layout?: any;
  blocks?: GeneratedSectionBlock[];
}

export interface PageSeo {
  title?: string;
  description?: string;
  og_image?: string;
}

export interface PageSettings {
  theme_preset?: string;
  primary_font?: string;
  body_font?: string;
  bg_color?: string;
  text_color?: string;
  accent_color?: string;
}

export interface PageBlueprint {
  version?: string;
  id?: string;
  page_type?: string;
  title: string;
  slug?: string;
  purpose?: string;
  description?: string;
  seo?: PageSeo;
  settings?: PageSettings;
  sections: GeneratedSectionInstance[];
}

export interface PageBuilderResult {
  blueprint: PageBlueprint;
  pageType?: string;
}

export interface ProductDataPayload {
  name: string;
  color?: string;
  material?: string;
  style?: string;
  size?: string;
  targetAudience?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  vendor?: string;
  productType?: string;
}

export interface CollectionDataPayload {
  name: string;
  category?: string;
  purpose?: string;
}

export interface ProductDescriptionJobData {
  jobId: string;
  storeId: number;
  userId: number;
  productId?: number | null;
  productData: ProductDataPayload;
}

export interface CollectionDescriptionJobData {
  jobId: string;
  storeId: number;
  userId: number;
  collectionId?: number | null;
  collectionData: CollectionDataPayload;
}

export interface AiGenerationResult {
  description: string;
}

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

export interface AppWebhookJob {
  storeId: number;
  topic: string;
  payload: Record<string, unknown>;
  targetUrl?: string;
  secret?: string;
  webhookId?: number;
}

export interface WhatsappSendJob {
  storeId: number;
  to: string;
  body: string;
  idempotencyKey?: string;
}
