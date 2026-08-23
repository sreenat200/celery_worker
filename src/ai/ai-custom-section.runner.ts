import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { UnrecoverableError, Worker, type Job } from 'bullmq';
import { createBullmqConnection } from '../jobs/bullmq.connection';
import { DeepSeekInferenceError, DeepSeekService } from './deepseek.service';
import { heapMb } from '../lib/sharp-limits';
import { PrismaService } from '../prisma/prisma.service';
import { planSectionLayout } from './ai-section-layout-planner';
import { buildCustomSectionSystemPrompt, buildCustomSectionUserPrompt } from './ai-section-prompt';
import { AiSectionValidationError, validateAiSectionBlueprint } from './ai-section-validator';

function out(msg: string) {
  process.stdout.write(`${new Date().toISOString()} [custom-section-worker] ${msg}\n`);
}

@Injectable()
export class AiCustomSectionRunner implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiCustomSectionRunner.name);
  private readonly connection = createBullmqConnection();
  private worker: Worker | null = null;

  constructor(
    private readonly deepSeek: DeepSeekService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    const concurrency = Math.max(1, parseInt(process.env.CUSTOM_SECTION_WORKER_CONCURRENCY || '2', 10) || 2);
    const lockMs = Math.max(
      120_000,
      parseInt(process.env.CUSTOM_SECTION_LOCK_MS || '240000', 10) || 240_000,
    );

    this.worker = new Worker(
      'custom-section-builder',
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

    this.worker.on('error', (err) => {
      out(`ERROR ${err.message}`);
    });

    out(`Listening on queue=custom-section-builder concurrency=${concurrency}`);
  }

  async onModuleDestroy() {
    this.logger.log('Shutting down Custom Section AI worker...');
    await this.worker?.close();
  }

  private async dispatch(job: Job): Promise<any> {
    if (job.name === 'generate-custom-section') {
      return this.handleGenerateSection(job);
    }
    throw new UnrecoverableError(`Unknown job name on custom-section queue: ${job.name}`);
  }

  private async handleGenerateSection(job: Job): Promise<any> {
    const { sectionId, storeId, userPrompt } = job.data;

    const existingSection = await this.prisma.ai_custom_section.findUnique({
      where: { id: sectionId },
    });

    if (existingSection && existingSection.status === 'completed' && existingSection.blueprint) {
      return { status: 'already_completed' };
    }

    if (existingSection && existingSection.store_id !== Number(storeId)) {
      throw new UnrecoverableError('Store mismatch for custom section job');
    }

    const plan = planSectionLayout(String(userPrompt || ''));
    const systemPrompt = buildCustomSectionSystemPrompt();
    const userPromptContent = buildCustomSectionUserPrompt(String(userPrompt || ''), plan);
    const modelName = this.deepSeek.getModel();

    let rawResponse: string;
    try {
      const maxTokens = Math.min(
        4096,
        Math.max(1024, parseInt(process.env.CUSTOM_SECTION_MAX_TOKENS || '2800', 10) || 2800),
      );
      rawResponse = await this.deepSeek.generateChat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPromptContent },
        ],
        { maxTokens, jsonMode: true, temperature: 0.2, disableThinking: true },
      );
    } catch (err: any) {
      const transient = err instanceof DeepSeekInferenceError ? err.isTransient : true;
      const message = err?.message || 'DeepSeek inference failed';
      await this.markSectionFailed(sectionId, transient ? 'DEEPSEEK_ERROR' : 'DEEPSEEK_FATAL', message);
      if (!transient) {
        throw new UnrecoverableError(message);
      }
      throw err;
    }

    let validated;
    try {
      validated = validateAiSectionBlueprint(rawResponse);
      validated = await this.bindStoreProducts(validated, Number(storeId));
    } catch (err: any) {
      const details =
        err instanceof AiSectionValidationError && err.details.length
          ? ` (${err.details.join('; ')})`
          : '';
      const code = err instanceof AiSectionValidationError ? err.code : 'VALIDATION_ERROR';
      const message = `${err.message}${details}`;
      this.logger.warn(`Rejecting invalid AI custom section output [${code}]: ${message}`);
      await this.markSectionFailed(sectionId, code, message);
      if (code === 'INVALID_JSON' && job.attemptsMade < 1) {
        throw new DeepSeekInferenceError(message, 502, true);
      }
      throw new UnrecoverableError(message);
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.ai_custom_section.update({
          where: { id: sectionId },
          data: {
            status: 'completed',
            name: validated.name.slice(0, 255),
            model_name: modelName,
            blueprint: validated as any,
            error_code: null,
            error_message: null,
          },
        });

        await tx.ai_custom_section_version.create({
          data: {
            section_id: sectionId,
            blueprint: validated as any,
          },
        });
      });

      return {
        success: true,
        model: modelName,
        name: validated.name,
        plan: plan.purpose,
      };
    } catch (err: any) {
      const errMsg = `Database save failed: ${err.message}`;
      await this.markSectionFailed(sectionId, 'DB_ERROR', errMsg);
      throw err;
    }
  }

  private layoutHasType(node: any, type: string): boolean {
    if (!node || typeof node !== 'object') return false;
    if (node.type === type) return true;
    return Array.isArray(node.children) && node.children.some((child: any) => this.layoutHasType(child, type));
  }

  private countProducts(node: any): number {
    if (!node || typeof node !== 'object') return 0;
    const self = node.type === 'product' ? 1 : 0;
    const kids = Array.isArray(node.children)
      ? node.children.reduce((sum: number, child: any) => sum + this.countProducts(child), 0)
      : 0;
    return self + kids;
  }

  private coerceProductCards(node: any): any {
    if (!node || typeof node !== 'object') return node;
    const children = Array.isArray(node.children) ? node.children.map((child: any) => this.coerceProductCards(child)) : undefined;
    const next = children ? { ...node, children } : { ...node };
    if ((next.type === 'grid' || next.type === 'row' || next.type === 'carousel') && Array.isArray(next.children)) {
      next.children = next.children.map((child: any) => {
        if (!child || child.type === 'product') return child;
        const types = (child.children || []).map((c: any) => c?.type);
        const card = types.includes('button') && (types.includes('heading') || types.includes('text') || types.includes('image'));
        return card ? { type: 'product', style: child.style, props: {} } : child;
      });
    }
    return next;
  }

  private stampSlots(node: any, counter = { n: 0 }): any {
    if (!node || typeof node !== 'object') return node;
    const next = { ...node, props: { ...(node.props || {}) } };
    if (next.type === 'product') {
      counter.n += 1;
      next.props.slot = counter.n;
    }
    if (Array.isArray(node.children)) {
      next.children = node.children.map((child: any) => this.stampSlots(child, counter));
    }
    return next;
  }

  private async bindStoreProducts(blueprint: any, storeId: number) {
    let layout = this.coerceProductCards(blueprint.layout);
    if (this.countProducts(layout) === 0 && /product/i.test(`${blueprint.name || ''}`)) {
      layout = {
        ...layout,
        children: [
          ...(layout.children || []),
          {
            type: 'grid',
            style: { desktop: { display: 'grid', gap: '24px', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' } },
            children: [{ type: 'product' }, { type: 'product' }, { type: 'product' }],
          },
        ],
      };
    }
    layout = this.stampSlots(layout);
    const count = this.countProducts(layout);
    if (count === 0) {
      return { ...blueprint, layout };
    }
    const products = await this.prisma.product.findMany({
      where: { store_id: storeId, is_active: true },
      select: { id: true },
      orderBy: [{ is_featured: 'desc' }, { id: 'desc' }],
      take: count,
    });
    const next = {
      ...blueprint,
      layout,
      schema: { ...(blueprint.schema || {}) },
      defaultSettings: { ...(blueprint.defaultSettings || {}) },
    };
    delete next.defaultSettings.product_title;
    delete next.defaultSettings.product_price;
    delete next.defaultSettings.product_image;
    delete next.schema.product_title;
    delete next.schema.product_price;
    delete next.schema.product_image;
    for (let i = 1; i <= count; i += 1) {
      next.schema[`product_${i}`] = {
        type: 'resourcePicker',
        label: count === 1 ? 'Product' : `Product ${i}`,
        category: 'content',
        resourceType: 'product',
      };
      if (products[i - 1]) {
        next.defaultSettings[`product_${i}`] = String(products[i - 1].id);
      }
    }
    if (products[0]) next.defaultSettings.product_id = String(products[0].id);
    return next;
  }

  private async markSectionFailed(sectionId: number, code: string, message: string) {
    await this.prisma.ai_custom_section.update({
      where: { id: sectionId },
      data: {
        status: 'failed',
        error_code: code.slice(0, 50),
        error_message: message.slice(0, 4000),
      },
    });
  }
}
