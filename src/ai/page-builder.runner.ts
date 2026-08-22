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
    const lockMs = Math.max(
      120_000,
      parseInt(process.env.PAGE_BUILDER_LOCK_MS || '240000', 10) || 240_000,
    );

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
      const maxTokens = parseInt(process.env.AZURE_MAX_TOKENS || '800', 10) || 800;
      rawResponse = await this.azureQwen.generateText(prompt, maxTokens);
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
    return `You are an expert e-commerce storefront architect and page builder engine.
Analyze the merchant's request and construct a comprehensive, high-converting storefront page layout with AT LEAST 7 sections.

Merchant Request:
"${userPrompt}"

Available Section Types & Settings:
${sectionsJson}

Storefront Hierarchy & Section Ordering Rules:
You MUST generate AT LEAST 7 relevant sections arranged in this exact high-converting storefront order:
1. Header Banner / Hero: (hero, ecommerce_hero, split_hero, video_hero, slider_hero, minimal_hero, or frame_scroll_hero)
2. Discovery / Categories / Stories: (collection_list or instagram_stories)
3. Main Products Showcase: (featured_products or featured_collection)
4. Spotlight / Promotion / Deals: (featured_product, image_banner, or countdown)
5. Brand Storytelling / Features: (image_with_text, rich_text, video, or model_3d)
6. Trust & Social Proof: (testimonials, product_reviews, or faq)
7. Final CTA / Customer Engagement: (newsletter or contact_form)

Section Output Rules:
- Generate 7 to 9 sections strictly following the ordering rules above.
- Tailor all headings, subheadings, and button copy specifically to the merchant's request.
- Use only valid section types and settings from the Available Sections schema.
- Output ONLY valid JSON matching the structure below without commentary.

JSON Format:
{
  "page": {
    "title": "Storefront Home",
    "purpose": "High-converting homepage",
    "sections": [
      { "id": "hero_1", "type": "hero", "settings": { "title": "Elevate Your Style", "subtitle": "Curated premium fashion releases", "hero_theme": "luxury", "hero_layout": "overlay", "bg_image": "/images/themes/theme_hero_luxury_banner.jpg", "button_text": "Shop Collection", "button_link": "/collections" }, "blocks": [] },
      { "id": "collection_list_1", "type": "collection_list", "settings": { "title": "Shop by Category" }, "blocks": [] },
      { "id": "featured_products_1", "type": "featured_products", "settings": { "title": "Trending Best-Sellers", "subtitle": "Our most coveted pieces" }, "blocks": [] },
      { "id": "image_banner_1", "type": "image_banner", "settings": { "heading": "Limited Season Offer", "subheading": "Up to 40% off online", "image": "/images/themes/theme_promo_banner.jpg", "button_text": "Claim Discount", "button_link": "/collections" }, "blocks": [] },
      { "id": "image_with_text_1", "type": "image_with_text", "settings": { "heading": "Crafted with Purpose", "image": "/images/themes/theme_story_craftsmanship.jpg", "content": "<p>We source only the finest sustainable materials.</p>", "button_text": "Learn More" }, "blocks": [] },
      { "id": "testimonials_1", "type": "testimonials", "settings": { "title": "Loved by Over 50,000+ Customers" }, "blocks": [{ "id": "t1", "type": "testimonial", "settings": { "author_name": "Sarah K.", "author_role": "Verified Customer", "quote": "<p>Incredible quality and fast delivery!</p>", "rating": "5" } }] },
      { "id": "faq_1", "type": "faq", "settings": { "title": "Frequently Asked Questions" }, "blocks": [{ "id": "f1", "type": "faq_item", "settings": { "q": "What is the return policy?", "a": "<p>We offer 30-day hassle-free returns.</p>" } }] },
      { "id": "newsletter_1", "type": "newsletter", "settings": { "heading": "Join the Inner Circle", "subheading": "Get 15% off your first purchase.", "button_text": "Subscribe" }, "blocks": [] }
    ]
  }
}

JSON Response:`;
  }
}
