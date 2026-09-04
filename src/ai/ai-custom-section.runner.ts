import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { UnrecoverableError, Worker, type Job } from 'bullmq';
import { createBullmqConnection } from '../jobs/bullmq.connection';
import { DeepSeekInferenceError, DeepSeekService } from './deepseek.service';
import { heapMb } from '../lib/sharp-limits';
import { PrismaService } from '../prisma/prisma.service';
import { planSectionLayout } from './ai-section-layout-planner';
import { applyExtractedStyle, planSectionStyle } from './ai-section-style-planner';
import {
  isBeforeAfterPrompt,
  isFaqPrompt,
  isLuxuryComboPrompt,
  isRepeatingRowsPrompt,
  isSimpleBannerPrompt,
  isVideoShowcasePrompt,
  synthesizeBeforeAfterBlueprint,
  synthesizeCollectionBlocksBlueprint,
  synthesizeFaqBlueprint,
  synthesizeLuxuryComboBlueprint,
  synthesizeRepeatingRowsBlueprint,
  synthesizeSimpleBannerBlueprint,
  synthesizeTestimonialBlueprint,
  synthesizeVideoShowcaseBlueprint,
} from './ai-section-synthesize';
import { composeBlueprint, shouldCompose } from './ai-section-compose';
import { buildCustomSectionSystemPrompt, buildCustomSectionUserPrompt } from './ai-section-prompt';
import { AiSectionValidationError, validateAiSectionBlueprint } from './ai-section-validator';
import { validateStoreResources } from './ai-section-resources';
import { polishBlueprint } from './style-polisher';
import { blueprintToUniversal } from './ai-section-universal';

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

    out(`Listening on queue=custom-section-builder concurrency=${concurrency} DEEPSEEK_MODEL=${this.deepSeek.getModel()}`);
  }

  async onModuleDestroy() {
    this.logger.log('Shutting down Custom Section AI worker...');
    await this.worker?.close();
  }

  private async dispatch(job: Job): Promise<any> {
    if (job.name === 'generate-custom-section') {
      return this.handleGenerateSection(job);
    }
    if (job.name === 'refine-custom-section') {
      return this.handleRefineSection(job);
    }
    throw new UnrecoverableError(`Unknown job name on custom-section queue: ${job.name}`);
  }

  private async setProgress(job: Job, sectionId: number, value: number) {
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    try {
      await job.updateProgress(clamped);
    } catch {
      /* queue progress is best-effort */
    }
    try {
      await this.prisma.ai_custom_section.update({
        where: { id: sectionId },
        data: { progress: clamped },
      });
    } catch {
      /* progress persistence is best-effort */
    }
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

    out(`job=${job.id} section=${sectionId} store=${storeId} attempt=${job.attemptsMade + 1}`);
    await this.setProgress(job, sectionId, 5);
    const plan = planSectionLayout(String(userPrompt || ''));
    const style = planSectionStyle(String(userPrompt || ''));
    await this.setProgress(job, sectionId, 20);
    const promptText = String(userPrompt || '');
    const useTestimonials = /\btestimonials?\b/i.test(promptText);
    const useFaq = isFaqPrompt(promptText);
    const useVideoShowcase = isVideoShowcasePrompt(promptText);
    const useSimpleBanner = isSimpleBannerPrompt(promptText);
    const useBeforeAfter = isBeforeAfterPrompt(promptText);
    const useRepeatingRows = isRepeatingRowsPrompt(promptText);
    const useLuxuryCombo = isLuxuryComboPrompt(promptText);
    const useDeterministic =
      !useTestimonials &&
      !useLuxuryCombo &&
      (plan.suggestedTree.includes('row x4') ||
        /\b\d+\s+(?:separate\s+)?collection sections\b/i.test(promptText) ||
        (/\bnecklaces?\b/i.test(promptText) && /\bearrings?\b/i.test(promptText)));
    if (shouldCompose(promptText, plan)) {
      const synthesized = composeBlueprint(promptText, plan, style);
      const validated = validateAiSectionBlueprint(JSON.stringify(synthesized));
      validated.defaultSettings = applyExtractedStyle(
        { ...synthesized.defaultSettings, ...(validated.defaultSettings || {}) },
        style.settings,
      );
      const bound = await this.bindStoreProducts(validated, Number(storeId), promptText);
      await validateStoreResources(this.prisma, Number(storeId), bound.defaultSettings || {});
      await this.saveBlueprint(sectionId, bound, 'planner', promptText);
      return { success: true, model: 'planner', name: bound.name, plan: 'compose' };
    }
    if (useLuxuryCombo) {
      const synthesized = synthesizeLuxuryComboBlueprint(promptText, style);
      const validated = validateAiSectionBlueprint(JSON.stringify(synthesized));
      validated.defaultSettings = applyExtractedStyle(
        { ...synthesized.defaultSettings, ...(validated.defaultSettings || {}) },
        style.settings,
      );
      const bound = await this.bindStoreProducts(validated, Number(storeId), promptText);
      await validateStoreResources(this.prisma, Number(storeId), bound.defaultSettings || {});
      await this.saveBlueprint(sectionId, bound, 'planner');
      return { success: true, model: 'planner', name: bound.name, plan: 'luxury-combo' };
    }
    if (useRepeatingRows) {
      const synthesized = synthesizeRepeatingRowsBlueprint(promptText, style);
      const validated = validateAiSectionBlueprint(JSON.stringify(synthesized));
      validated.defaultSettings = applyExtractedStyle(
        { ...synthesized.defaultSettings, ...(validated.defaultSettings || {}) },
        style.settings,
      );
      await this.saveBlueprint(sectionId, validated, 'planner');
      return { success: true, model: 'planner', name: validated.name, plan: 'repeating-rows' };
    }
    if (useBeforeAfter) {
      const synthesized = synthesizeBeforeAfterBlueprint(promptText, style);
      const validated = validateAiSectionBlueprint(JSON.stringify(synthesized));
      validated.defaultSettings = applyExtractedStyle(
        { ...synthesized.defaultSettings, ...(validated.defaultSettings || {}) },
        style.settings,
      );
      await this.saveBlueprint(sectionId, validated, 'planner');
      return { success: true, model: 'planner', name: validated.name, plan: 'before-after' };
    }
    if (useSimpleBanner) {
      const synthesized = synthesizeSimpleBannerBlueprint(promptText, style);
      const validated = validateAiSectionBlueprint(JSON.stringify(synthesized));
      validated.defaultSettings = applyExtractedStyle(
        { ...synthesized.defaultSettings, ...(validated.defaultSettings || {}) },
        style.settings,
      );
      await this.saveBlueprint(sectionId, validated, 'planner');
      return { success: true, model: 'planner', name: validated.name, plan: 'simple-banner' };
    }
    if (useVideoShowcase) {
      const synthesized = synthesizeVideoShowcaseBlueprint(promptText, style);
      const validated = validateAiSectionBlueprint(JSON.stringify(synthesized));
      validated.defaultSettings = applyExtractedStyle(
        { ...synthesized.defaultSettings, ...(validated.defaultSettings || {}) },
        style.settings,
      );
      await this.saveBlueprint(sectionId, validated, 'planner');
      return { success: true, model: 'planner', name: validated.name, plan: 'video-showcase' };
    }
    if (useFaq) {
      const synthesized = synthesizeFaqBlueprint(promptText, style);
      const validated = validateAiSectionBlueprint(JSON.stringify(synthesized));
      validated.defaultSettings = applyExtractedStyle(
        { ...synthesized.defaultSettings, ...(validated.defaultSettings || {}) },
        style.settings,
      );
      await this.saveBlueprint(sectionId, validated, 'planner');
      return { success: true, model: 'planner', name: validated.name, plan: 'faq' };
    }
    if (useTestimonials) {
      const synthesized = synthesizeTestimonialBlueprint(promptText, style);
      const validated = validateAiSectionBlueprint(JSON.stringify(synthesized));
      validated.defaultSettings = applyExtractedStyle(validated.defaultSettings || {}, style.settings);
      await this.saveBlueprint(sectionId, validated, 'planner');
      return { success: true, model: 'planner', name: validated.name, plan: 'testimonials' };
    }
    if (useDeterministic) {
      const synthesized = synthesizeCollectionBlocksBlueprint(promptText, style);
      const validated = validateAiSectionBlueprint(JSON.stringify(synthesized));
      validated.defaultSettings = applyExtractedStyle(validated.defaultSettings || {}, style.settings);
      await validateStoreResources(this.prisma, Number(storeId), validated.defaultSettings || {});
      await this.saveBlueprint(sectionId, validated, 'planner');
      return { success: true, model: 'planner', name: validated.name, plan: plan.purpose };
    }
    const systemPrompt = buildCustomSectionSystemPrompt();
    const userPromptContent = buildCustomSectionUserPrompt(String(userPrompt || ''), plan, style);
    const modelName = this.deepSeek.getModel();

    let rawResponse: string;
    try {
      const cap = Math.min(16384, Math.max(8192, parseInt(process.env.CUSTOM_SECTION_MAX_TOKENS || '8192', 10) || 8192));
      const maxTokens = cap;
      rawResponse = await this.deepSeek.generateChat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPromptContent },
        ],
        { maxTokens, jsonMode: true, temperature: 0.2, disableThinking: true },
      );
      await this.setProgress(job, sectionId, 60);
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
      if (rawResponse.length > Number(process.env.AI_BLUEPRINT_MAX_CHARS || 120000)) {
        throw new AiSectionValidationError('AI response exceeds size limit', 'BLUEPRINT_TOO_LARGE');
      }
      validated = validateAiSectionBlueprint(rawResponse);
      validated.defaultSettings = applyExtractedStyle(validated.defaultSettings || {}, style.settings);
      validated = await this.bindStoreProducts(validated, Number(storeId), String(userPrompt || ''));
      await validateStoreResources(this.prisma, Number(storeId), validated.defaultSettings || {});
      await this.setProgress(job, sectionId, 90);
    } catch (err: any) {
      const details =
        err instanceof AiSectionValidationError && err.details.length
          ? ` (${err.details.join('; ')})`
          : '';
      const code = err instanceof AiSectionValidationError ? err.code : 'VALIDATION_ERROR';
      const message = `${err.message}${details}`;
      this.logger.warn(`Rejecting invalid AI custom section output [${code}]: ${message}`);
      if (code === 'INVALID_JSON') {
        try {
          const compact = await this.deepSeek.generateChat(
            [
              {
                role: 'system',
                content:
                  'Return ONE complete JSON object only: {"name":"...","schema":{},"defaultSettings":{},"layout":{"type":"container","children":[]}}. Max 20 layout nodes. Close every brace. No markdown.',
              },
              { role: 'user', content: String(userPrompt || plan.purpose || 'hero banner') },
            ],
            { maxTokens: 4096, jsonMode: true, temperature: 0.1, disableThinking: true },
          );
          validated = validateAiSectionBlueprint(compact);
          validated.defaultSettings = applyExtractedStyle(validated.defaultSettings || {}, style.settings);
          validated = await this.bindStoreProducts(validated, Number(storeId), String(userPrompt || ''));
          await validateStoreResources(this.prisma, Number(storeId), validated.defaultSettings || {});
        } catch {
          const synthesized = synthesizeSimpleBannerBlueprint(String(userPrompt || ''), style);
          validated = validateAiSectionBlueprint(JSON.stringify(synthesized));
          validated.defaultSettings = applyExtractedStyle(validated.defaultSettings || {}, style.settings);
        }
      } else {
        await this.markSectionFailed(sectionId, code, message);
        throw new UnrecoverableError(message);
      }
    }

    try {
      await this.saveBlueprint(sectionId, validated, modelName);

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

  private async handleRefineSection(job: Job): Promise<any> {
    const { sectionId, storeId, userPrompt, followUpPrompt } = job.data;
    const existing = await this.prisma.ai_custom_section.findUnique({
      where: { id: sectionId },
    });
    if (!existing) {
      throw new UnrecoverableError('Refine target section not found');
    }
    if (existing.store_id !== Number(storeId)) {
      throw new UnrecoverableError('Store mismatch for refine job');
    }
    const currentBlueprint = existing.blueprint || (existing as any).versions?.[0]?.blueprint;
    if (!currentBlueprint) {
      await this.markSectionFailed(sectionId, 'NO_BLUEPRINT', 'No existing blueprint to refine');
      throw new UnrecoverableError('No existing blueprint to refine');
    }

    await this.setProgress(job, sectionId, 20);

    const systemPrompt = `You are an expert ecommerce storefront section designer.
The merchant wants you to refine an EXISTING AI-generated section. Return the full, updated
AiSectionBlueprint JSON object (name, schema, defaultSettings, layout) that reflects the
requested change while preserving all unrelated structure, content, and settings.

RULES
- Keep the same component registry and {{settings.field}} binding style.
- Only output valid JSON. No markdown. No HTML/CSS/JS.
- Do not invent product/collection IDs.`;
    const userPromptContent = `Original prompt:\n${String(userPrompt || '')}\n\nRefinement request:\n${String(followUpPrompt || '')}\n\nCurrent blueprint (edit this JSON):\n${JSON.stringify(currentBlueprint)}`;

    let rawResponse: string;
    try {
      rawResponse = await this.deepSeek.generateChat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPromptContent },
        ],
        { maxTokens: 8192, jsonMode: true, temperature: 0.2, disableThinking: true },
      );
      await this.setProgress(job, sectionId, 60);
    } catch (err: any) {
      const transient = err instanceof DeepSeekInferenceError ? err.isTransient : true;
      await this.markSectionFailed(sectionId, transient ? 'DEEPSEEK_ERROR' : 'DEEPSEEK_FATAL', err?.message || 'DeepSeek inference failed');
      if (!transient) throw new UnrecoverableError(err?.message || 'DeepSeek inference failed');
      throw err;
    }

    let validated: any;
    try {
      validated = validateAiSectionBlueprint(rawResponse);
      validated = await this.bindStoreProducts(validated, Number(storeId), String(userPrompt || ''));
      await validateStoreResources(this.prisma, Number(storeId), validated.defaultSettings || {});
      await this.setProgress(job, sectionId, 90);
    } catch (err: any) {
      const code = err instanceof AiSectionValidationError ? err.code : 'VALIDATION_ERROR';
      await this.markSectionFailed(sectionId, code, err?.message || 'Refine validation failed');
      throw new UnrecoverableError(err?.message || 'Refine validation failed');
    }

    await this.saveBlueprint(sectionId, validated, this.deepSeek.getModel());
    return { success: true, model: this.deepSeek.getModel(), name: validated.name, plan: 'refine' };
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

  private stripProductNodes(node: any): any {
    if (!node || typeof node !== 'object') return node;
    if (node.type === 'product') return null;
    if (!Array.isArray(node.children)) return node;
    const children = node.children.map((child: any) => this.stripProductNodes(child)).filter(Boolean);
    return { ...node, children };
  }

  private coerceProductCards(node: any): any {
    if (!node || typeof node !== 'object') return node;
    const children = Array.isArray(node.children) ? node.children.map((child: any) => this.coerceProductCards(child)) : undefined;
    const next = children ? { ...node, children } : { ...node };
    if ((next.type === 'grid' || next.type === 'carousel') && Array.isArray(next.children) && next.children.length >= 2) {
      const hasVideo = next.children.some((child: any) => child?.type === 'video');
      if (!hasVideo) {
        next.children = next.children.map((child: any) => {
          if (!child || child.type === 'product') return child;
          const copy = JSON.stringify(child.props || child.children || []).toLowerCase();
          if (/featured product|add to cart|₹\d+|\$\d+/.test(copy)) {
            return { type: 'product', style: child.style, props: {} };
          }
          return child;
        });
      }
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

  private layoutNeedsProducts(node: any): boolean {
    if (!node || typeof node !== 'object') return false;
    if (
      node.type === 'product' ||
      node.type === 'product_detail' ||
      node.type === 'recommend' ||
      node.type === 'specs' ||
      node.type === 'reviews' ||
      node.type === 'hotspot_pin'
    ) {
      return true;
    }
    return Array.isArray(node.children) && node.children.some((child: any) => this.layoutNeedsProducts(child));
  }

  private async bindStoreProducts(blueprint: any, storeId: number, _userPrompt: string) {
    if (!this.layoutNeedsProducts(blueprint.layout) && !this.countProducts(blueprint.layout)) {
      return blueprint;
    }
    const layout = this.stampSlots(this.coerceProductCards(blueprint.layout));
    const productNodes = this.countProducts(layout);
    const recommendSlots = this.layoutHasType(layout, 'recommend') ? 6 : 0;
    const count = Math.max(productNodes, recommendSlots);
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

  private async saveBlueprint(sectionId: number, validated: any, modelName: string, prompt?: string) {
    const polished = polishBlueprint(validated);
    let promptText = prompt || '';
    if (!promptText) {
      const row = await this.prisma.ai_custom_section.findUnique({
        where: { id: sectionId },
        select: { prompt: true },
      });
      promptText = String(row?.prompt || '');
    }
    let packed: any = polished;
    try {
      const universal = blueprintToUniversal(promptText, polished);
      packed = { ...polished, universal };
    } catch (err: any) {
      this.logger.warn(`Universal section conversion skipped: ${err?.message || err}`);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.ai_custom_section.update({
        where: { id: sectionId },
        data: {
          status: 'completed',
          progress: 100,
          name: String(polished.name || 'Custom Section').slice(0, 255),
          model_name: modelName,
          blueprint: packed as any,
          error_code: null,
          error_message: null,
        },
      });
      await tx.ai_custom_section_version.create({
        data: { section_id: sectionId, blueprint: packed as any },
      });
    });
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
