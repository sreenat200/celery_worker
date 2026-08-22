import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker, type Job } from 'bullmq';
import { createBullmqConnection } from '../jobs/bullmq.connection';
import {
  AI_CONTENT_GENERATION_QUEUE,
  AI_JOB,
  type ProductDescriptionJobData,
  type CollectionDescriptionJobData,
  type AiGenerationResult,
  type ProductDataPayload,
  type CollectionDataPayload,
} from '../jobs/bullmq.constants';
import { AzureQwenService } from './azure-qwen.service';
import { AiResponseValidator } from './ai-response.validator';
import { PrismaService } from '../prisma/prisma.service';

function out(msg: string) {
  process.stdout.write(`${new Date().toISOString()} [ai-worker] ${msg}\n`);
}

@Injectable()
export class AiGenerationRunner implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('AiGenerationRunner');
  private readonly connection = createBullmqConnection();
  private worker: Worker | null = null;

  constructor(
    private readonly azureQwen: AzureQwenService,
    private readonly validator: AiResponseValidator,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    const concurrency = Math.max(1, parseInt(process.env.AI_WORKER_CONCURRENCY || '3', 10) || 3);
    const lockMs = 120_000;

    this.worker = new Worker(
      AI_CONTENT_GENERATION_QUEUE,
      async (job) => this.dispatch(job),
      {
        connection: this.connection,
        concurrency,
        lockDuration: lockMs,
        stalledInterval: 60_000,
      },
    );

    this.worker.on('active', (job) => {
      out(`START job=${job.id} name=${job.name} attempt=${job.attemptsMade + 1} store=${job.data?.storeId}`);
    });

    this.worker.on('completed', (job) => {
      out(`DONE  job=${job.id} name=${job.name} store=${job.data?.storeId}`);
    });

    this.worker.on('failed', (job, err) => {
      out(`FAIL  job=${job?.id} name=${job?.name} attempt=${(job?.attemptsMade || 0) + 1} error=${err.message}`);
    });

    this.worker.on('stalled', (jobId) => {
      out(`STALL job=${jobId}`);
    });

    this.worker.on('error', (err) => {
      out(`ERROR ${err.message}`);
    });

    out(`Listening on queue=${AI_CONTENT_GENERATION_QUEUE} concurrency=${concurrency}`);
  }

  async onModuleDestroy() {
    this.logger.log('Shutting down AI Generation runner...');
    await this.worker?.close();
  }

  private async dispatch(job: Job): Promise<AiGenerationResult> {
    switch (job.name) {
      case AI_JOB.GENERATE_PRODUCT_DESCRIPTION:
        return this.handleProductDescription(job.data as ProductDescriptionJobData);

      case AI_JOB.GENERATE_COLLECTION_DESCRIPTION:
        return this.handleCollectionDescription(job.data as CollectionDescriptionJobData);

      default:
        throw new Error(`Unknown job name on AI queue: ${job.name}`);
    }
  }

  private async handleProductDescription(data: ProductDescriptionJobData): Promise<AiGenerationResult> {
    const { storeId, productId, productData } = data;

    if (productId) {
      const product = await this.prisma.product.findFirst({
        where: { id: Number(productId), store_id: Number(storeId) },
        select: { id: true, name: true },
      });
      if (!product) {
        throw new Error(`Product ${productId} does not belong to store ${storeId}`);
      }
    }

    const prompt = this.buildProductPrompt(productData);
    const rawResponse = await this.azureQwen.generateText(prompt, 256);
    const validated = this.validator.validateAndExtract(rawResponse, 'product');

    return validated;
  }

  private async handleCollectionDescription(data: CollectionDescriptionJobData): Promise<AiGenerationResult> {
    const { storeId, collectionId, collectionData } = data;

    if (collectionId) {
      const collection = await this.prisma.collection.findFirst({
        where: { id: Number(collectionId), store_id: Number(storeId) },
        select: { id: true, name: true },
      });
      if (!collection) {
        throw new Error(`Collection ${collectionId} does not belong to store ${storeId}`);
      }
    }

    const prompt = this.buildCollectionPrompt(collectionData);
    const rawResponse = await this.azureQwen.generateText(prompt, 256);
    const validated = this.validator.validateAndExtract(rawResponse, 'collection');

    return validated;
  }

  private buildProductPrompt(p: ProductDataPayload): string {
    const lines: string[] = [];
    lines.push(`Product: ${p.name}`);
    if (p.color) lines.push(`Color: ${p.color}`);
    if (p.material) lines.push(`Material: ${p.material}`);
    if (p.style) lines.push(`Style: ${p.style}`);
    if (p.size) lines.push(`Size: ${p.size}`);
    if (p.targetAudience) lines.push(`Target Audience: ${p.targetAudience}`);
    if (p.category) lines.push(`Category: ${p.category}`);
    if (p.subcategory) lines.push(`Subcategory: ${p.subcategory}`);
    if (p.brand) lines.push(`Brand: ${p.brand}`);
    if (p.vendor) lines.push(`Vendor: ${p.vendor}`);
    if (p.productType) lines.push(`Product Type: ${p.productType}`);

    return `Write an engaging 40-50 word e-commerce product description for:
${lines.join('\n')}

Include an inviting call-to-action to shop or add to cart.
Do not output notes, code, or rules. Output only the description text.

Description:`;
  }

  private buildCollectionPrompt(c: CollectionDataPayload): string {
    const lines: string[] = [];
    lines.push(`Collection: ${c.name}`);
    if (c.category) lines.push(`Category: ${c.category}`);
    if (c.purpose) lines.push(`Purpose: ${c.purpose}`);

    return `Write an engaging 30-45 word e-commerce collection description for:
${lines.join('\n')}

Include an inviting call-to-action to explore the collection.
Do not output notes, code, or rules. Output only the description text.

Description:`;
  }
}
