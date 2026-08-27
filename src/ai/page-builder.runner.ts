import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker, type Job } from 'bullmq';
import { createBullmqConnection } from '../jobs/bullmq.connection';
import {
  PAGE_BUILDER_QUEUE,
  PAGE_BUILDER_JOB,
  type PageBuilderJobData,
  type PageBuilderResult,
  type PageBlueprint,
} from '../jobs/bullmq.constants';
import { DeepSeekService } from './deepseek.service';
import { PageBuilderValidator } from './page-builder-validator.service';
import { polishBlueprint } from './style-polisher';
import { getBaselinesPromptContext } from './premium-baselines';
import { getSectionSchemaPromptContext } from './theme-sections.schema';
import {
  derivePageType,
  getAllowedSectionsForPageType,
  type PageType,
} from './page-capability-registry';
import { heapMb } from '../lib/sharp-limits';

const SYSTEM_PROMPT = `You are an expert e-commerce storefront architect and universal page builder.
You design composable storefront pages from natural language. You always output ONLY valid JSON
matching the requested schema. You never output markdown, code fences, or commentary.`;

function out(msg: string) {
  process.stdout.write(`${new Date().toISOString()} [page-builder-worker] ${msg}\n`);
}

@Injectable()
export class PageBuilderRunner implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PageBuilderRunner.name);
  private readonly connection = createBullmqConnection();
  private worker: Worker | null = null;

  constructor(
    private readonly deepSeek: DeepSeekService,
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
        return this.handleGenerateBlueprint(job);
      case PAGE_BUILDER_JOB.REFINE_PAGE_BLUEPRINT:
        return this.handleRefineBlueprint(job);
      default:
        throw new Error(`Unknown job name on page-builder queue: ${job.name}`);
    }
  }

  private setProgress(job: Job, value: number) {
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    return job.updateProgress(clamped).catch(() => undefined);
  }

  private async handleGenerateBlueprint(job: Job): Promise<PageBuilderResult> {
    const { storeId, userPrompt } = job.data as PageBuilderJobData;

    if (!userPrompt || userPrompt.trim().length === 0) {
      throw new Error('User prompt is required to generate a page blueprint.');
    }

    await this.setProgress(job, 25);

    const pageType: PageType = derivePageType(userPrompt);
    const allowed = getAllowedSectionsForPageType(pageType);
    const sectionsRegistryJson = getSectionSchemaPromptContext();
    const prompt = this.buildPageBuilderPrompt(userPrompt, sectionsRegistryJson, pageType, allowed);

    let rawResponse: string;
    try {
      const defaultMax = 8192;
      const maxTokens = Math.max(4096, parseInt(process.env.PAGE_BUILDER_MAX_TOKENS || process.env.DEEPSEEK_MAX_TOKENS || String(defaultMax), 10) || defaultMax);
      rawResponse = await this.deepSeek.generateChat(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        { maxTokens, jsonMode: true, temperature: 0.2, disableThinking: true },
      );
    } catch (err: any) {
      this.logger.error(`DeepSeek inference error during page building: ${err.message}`);
      throw err;
    }

    await this.setProgress(job, 60);

    const blueprint = polishBlueprint(
      await this.validator.validateAndFormatBlueprint(
        rawResponse,
        Number(storeId),
        userPrompt,
        pageType,
      ),
    );

    await this.setProgress(job, 100);

    return {
      blueprint,
      pageType,
    };
  }

  private async handleRefineBlueprint(job: Job): Promise<PageBuilderResult> {
    const { storeId, userPrompt, followUpPrompt, currentBlueprint } = job.data as PageBuilderJobData;

    if (!followUpPrompt || followUpPrompt.trim().length === 0) {
      throw new Error('Refinement prompt is required.');
    }

    await this.setProgress(job, 25);

    const pageType: PageType =
      (currentBlueprint?.page_type as PageType) || derivePageType(String(userPrompt || followUpPrompt));
    const allowed = getAllowedSectionsForPageType(pageType);
    const sectionsRegistryJson = getSectionSchemaPromptContext();
    const prompt = this.buildRefinePrompt(
      String(userPrompt || ''),
      followUpPrompt,
      currentBlueprint || null,
      sectionsRegistryJson,
      pageType,
      allowed,
    );

    let rawResponse: string;
    try {
      const maxTokens = Math.max(4096, parseInt(process.env.PAGE_BUILDER_MAX_TOKENS || process.env.DEEPSEEK_MAX_TOKENS || '8192', 10) || 8192);
      rawResponse = await this.deepSeek.generateChat(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        { maxTokens, jsonMode: true, temperature: 0.2, disableThinking: true },
      );
    } catch (err: any) {
      this.logger.error(`DeepSeek inference error during page refinement: ${err.message}`);
      throw err;
    }

    await this.setProgress(job, 60);

    const blueprint = polishBlueprint(
      await this.validator.validateAndFormatBlueprint(
        rawResponse,
        Number(storeId),
        String(userPrompt || followUpPrompt),
        pageType,
      ),
    );

    await this.setProgress(job, 100);

    return { blueprint, pageType };
  }

  private buildPageBuilderPrompt(
    userPrompt: string,
    sectionsJson: string,
    pageType: PageType,
    allowed: string[] | 'any',
  ): string {
    const allowedBlock =
      allowed === 'any'
        ? 'You may use any registered section type.'
        : `Allowed sections for a "${pageType}" page (use ONLY these):\n${allowed.join(', ')}`;

    return `You are an expert e-commerce storefront architect and universal page builder.
Analyze the merchant's request and construct a high-converting storefront page as a composable blueprint.

Merchant Request:
"${userPrompt}"

Detected page type: ${pageType}

${allowedBlock}

Available Section Types & Settings:
${sectionsJson}

AVAILABLE COMPOSABLE BASELINES (use as starting skeletons; fill with merchant-specific content):
${getBaselinesPromptContext()}

Composition Rules:
- Choose the RIGHT number of sections for this request (typically 3 to 10). Do NOT force a fixed count.
- Order sections in a natural high-converting flow. No fixed 7-layer sequence is required.
- Tailor every heading, subtitle, and button to the merchant's request.
- Use only valid section types and settings from the Available Sections schema.
- Prefer composable, reusable sections and avoid redundant near-duplicate sections.
- Do not invent product/collection IDs; leave resource pickers empty.

JSON Format (universal page blueprint v2.0):
{
  "version": "2.0",
  "page_type": "${pageType}",
  "title": "Meaningful page title",
  "slug": "url-handle",
  "description": "short summary",
  "seo": { "title": "SEO title", "description": "SEO meta description", "og_image": "" },
  "settings": { "theme_preset": "luxury_dark", "primary_font": "Inter", "body_font": "Inter", "bg_color": "#FFFFFF", "text_color": "#0F172A", "accent_color": "#F59E0B" },
  "sections": [
    { "id": "hero_1", "type": "hero", "title": "Hero", "hidden": false, "settings": { "title": "Elevate Your Style", "subtitle": "Curated premium fashion", "button_text": "Shop Now", "button_link": "/collections" }, "blocks": [] }
  ]
}

Output ONLY valid JSON. No markdown. No commentary.`;
  }

  private buildRefinePrompt(
    userPrompt: string,
    followUp: string,
    current: PageBlueprint | null,
    sectionsJson: string,
    pageType: PageType,
    allowed: string[] | 'any',
  ): string {
    const allowedBlock =
      allowed === 'any'
        ? 'You may use any registered section type.'
        : `Allowed sections for a "${pageType}" page (use ONLY these):\n${allowed.join(', ')}`;

    return `You are an expert e-commerce storefront architect refining an existing page blueprint.

Original request: "${userPrompt}"
Refinement request: "${followUp}"

${allowedBlock}

Available Section Types & Settings:
${sectionsJson}

AVAILABLE COMPOSABLE BASELINES (use as starting skeletons; fill with merchant-specific content):
${getBaselinesPromptContext()}

Current blueprint (edit this — preserve unrelated sections and settings):
${current ? JSON.stringify(current) : '{}'}

Return the FULL updated page blueprint as valid JSON (same v2.0 shape). Only change what the refinement requests. Do not invent product/collection IDs. Output ONLY valid JSON, no commentary.`;
  }
}
