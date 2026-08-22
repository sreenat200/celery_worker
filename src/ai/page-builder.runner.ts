import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker, type Job } from 'bullmq';
import { createBullmqConnection } from '../jobs/bullmq.connection';
import {
  PAGE_BUILDER_QUEUE,
  PAGE_BUILDER_JOB,
  type PageBuilderJobData,
  type PageBuilderResult,
} from '../jobs/bullmq.constants';
import { AzureQwenService } from './azure-qwen.service';
import { PageBuilderValidator } from './page-builder-validator.service';
import { getSectionSchemaPromptContext } from './theme-sections.schema';
import { heapMb } from '../lib/sharp-limits';

function out(msg: string) {
  process.stdout.write(`${new Date().toISOString()} [page-builder-worker] ${msg}\n`);
}

@Injectable()
export class PageBuilderRunner implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PageBuilderRunner.name);
  private readonly connection = createBullmqConnection();
  private worker: Worker | null = null;

  constructor(
    private readonly azureQwen: AzureQwenService,
    private readonly validator: PageBuilderValidator,
  ) {}

  onModuleInit() {
    const concurrency = Math.max(1, parseInt(process.env.PAGE_BUILDER_WORKER_CONCURRENCY || '2', 10) || 2);
    const lockMs = 120_000;

    this.worker = new Worker(
      PAGE_BUILDER_QUEUE,
      async (job) => this.dispatch(job),
      {
        connection: this.connection,
        concurrency,
        lockDuration: lockMs,
        stalledInterval: 60_000,
      },
    );

    this.worker.on('active', (job) => {
      out(`START id=${job.id} name=${job.name} store=${job.data?.storeId} attempt=${job.attemptsMade + 1} rss=${heapMb()}mb`);
    });

    this.worker.on('completed', (job) => {
      out(`DONE  id=${job.id} name=${job.name} store=${job.data?.storeId} rss=${heapMb()}mb`);
    });

    this.worker.on('failed', (job, err) => {
      out(`FAIL  id=${job?.id} name=${job?.name} attempt=${(job?.attemptsMade || 0) + 1} error=${err.message}`);
    });

    this.worker.on('stalled', (jobId) => {
      out(`STALL id=${jobId}`);
    });

    this.worker.on('error', (err) => {
      out(`ERROR ${err.message}`);
    });

    out(`Listening on queue=${PAGE_BUILDER_QUEUE} concurrency=${concurrency}`);
  }

  async onModuleDestroy() {
    this.logger.log('Shutting down Page Builder AI worker...');
    await this.worker?.close();
  }

  private async dispatch(job: Job): Promise<PageBuilderResult> {
    switch (job.name) {
      case PAGE_BUILDER_JOB.GENERATE_PAGE_BLUEPRINT:
        return this.handleGenerateBlueprint(job.data as PageBuilderJobData);

      default:
        throw new Error(`Unknown job name on page-builder queue: ${job.name}`);
    }
  }

  private async handleGenerateBlueprint(data: PageBuilderJobData): Promise<PageBuilderResult> {
    const { storeId, userPrompt } = data;

    if (!userPrompt || userPrompt.trim().length === 0) {
      throw new Error('User prompt is required to generate a page blueprint.');
    }

    const sectionsRegistryJson = getSectionSchemaPromptContext();
    const prompt = this.buildPageBuilderPrompt(userPrompt, sectionsRegistryJson);

    let rawResponse: string;
    try {
      rawResponse = await this.azureQwen.generateText(prompt, 1500);
    } catch (err: any) {
      this.logger.error(`Azure Qwen inference error during page building: ${err.message}`);
      throw err;
    }

    const blueprint = await this.validator.validateAndFormatBlueprint(
      rawResponse,
      Number(storeId),
      userPrompt,
    );

    return {
      blueprint,
    };
  }

  private buildPageBuilderPrompt(userPrompt: string, sectionsJson: string): string {
    return `<|im_start|>system
You are a page-builder planning engine. Analyze the user's request and select the most appropriate sections from the provided Theme Editor section registry. You MUST use only the available section types, fields, blocks, defaults, and option values provided in the registry. Never invent sections, fields, values, resource IDs, products, collections, media IDs, menu IDs, or application capabilities. Return ONLY valid JSON.

Section Selection Rules:
1. Use only sections from the provided section registry.
2. Select sections based on the user's intent to create a logical, high-converting storefront page structure.
3. Order sections hierarchically (e.g. Hero -> Products / Collections -> Social Proof / Reviews / Features -> Testimonials / FAQ -> WhatsApp / Newsletter).
4. Do not add unnecessary sections or duplicate sections unless requested.
5. Use commerce sections (featured_products, collection_list, featured_product) for product requests.
6. Use marketing sections (testimonials, newsletter, faq, countdown, instagram_stories) when relevant.
7. Use frame_scroll_hero for frame-based scroll experiences, model_3d only for 3D model requirements, and product_template only for product detail pages.
8. Output ONLY the JSON object conforming to the format below.<|im_end|>
<|im_start|>user
User Request:
"${userPrompt}"

Available Sections Registry:
${sectionsJson}

Output JSON Format:
{
  "page": {
    "title": "Clean, descriptive page title",
    "purpose": "Concise summary of page purpose",
    "sections": [
      {
        "id": "hero_1",
        "type": "hero",
        "settings": {
          "title": "Headline",
          "subtitle": "Description",
          "hero_theme": "luxury",
          "hero_layout": "overlay",
          "content_position": "middle_center",
          "alignment": "center",
          "button_text": "Shop Now",
          "button_link": "/collections"
        },
        "blocks": []
      }
    ]
  }
}
<|im_end|>
<|im_start|>assistant
{`;
  }
}
