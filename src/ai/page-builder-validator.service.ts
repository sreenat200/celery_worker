import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  THEME_SECTION_REGISTRY,
  type SectionDefinition,
} from './theme-sections.schema';
import {
  type PageBlueprint,
  type GeneratedSectionInstance,
  type GeneratedSectionBlock,
} from '../jobs/bullmq.constants';
import { PrismaService } from '../prisma/prisma.service';
import { UniversalPageBlueprintSchema } from './universal-page-blueprint.schema';
import {
  normalizeComponentType,
  ALLOWED_PROPS,
  ALLOWED_STYLE_PROPERTIES,
} from './ai-section-component-registry';
import { validateStoreResources } from './ai-section-resources';
import {
  getAllowedSectionsForPageType,
  type PageType,
} from './page-capability-registry';

export const THEME_DEFAULT_IMAGES = {
  hero: '/images/themes/theme_hero_luxury_banner.jpg',
  collection: '/images/themes/theme_collection_curation.jpg',
  image_banner: '/images/themes/theme_promo_banner.jpg',
  image_with_text: '/images/themes/theme_story_craftsmanship.jpg',
  product_spotlight: '/images/themes/theme_product_spotlight.jpg',
};

const UNSAFE_PATTERN = /<script|<\/script|javascript:|vbscript:|data:\s*text\/html|onerror\s*=|onload\s*=|onclick\s*=|<\/style|<iframe|<object|<embed/i;

@Injectable()
export class PageBuilderValidator {
  private readonly logger = new Logger(PageBuilderValidator.name);

  constructor(private readonly prisma: PrismaService) {}

  async validateAndFormatBlueprint(
    rawText: string,
    storeId: number,
    userPrompt: string,
    pageType?: PageType,
  ): Promise<PageBlueprint> {
    const rawJson = this.extractJson(rawText);
    if (!rawJson) {
      this.logger.warn(`Could not extract valid JSON from LLM response. Returning minimal fallback.`);
      return this.buildFallbackBlueprint(userPrompt, pageType);
    }

    const pageData = rawJson.page || rawJson;
    const title = this.sanitizeText(pageData.title) || this.deriveTitleFromPrompt(userPrompt);
    const purpose = this.sanitizeText(pageData.purpose) || 'Custom Storefront Page';
    const rawSections = Array.isArray(pageData.sections) ? pageData.sections : [];
    const resolvedPageType = (this.sanitizeText(pageData.page_type) || pageType || 'custom_page') as PageType;

    // Page-type-aware allowed sections (tier 1 capability enforcement)
    const allowed = getAllowedSectionsForPageType(resolvedPageType);

    const validatedSections: GeneratedSectionInstance[] = [];

    for (const sec of rawSections) {
      if (!sec || typeof sec !== 'object') continue;

      const type = String(sec.type || '').trim().toLowerCase();

      // Layout chrome is not a body section
      if (type === 'header' || type === 'footer' || type === 'whatsapp') continue;

      // Capability enforcement: drop sections not allowed for this page type
      if (allowed !== 'any' && !allowed.includes(type)) {
        this.logger.warn(`Skipping section type "${type}" — not allowed for page type "${resolvedPageType}".`);
        continue;
      }

      const def: SectionDefinition | undefined = THEME_SECTION_REGISTRY[type];
      if (!def) {
        this.logger.warn(`Skipping unsupported section type: "${type}"`);
        continue;
      }

      const settings = this.validateSectionSettings(sec.settings || {}, def, type);
      const blocks = this.validateSectionBlocks(sec.blocks, def);
      const layout = this.sanitizeLayout(sec.layout);

      // Validate any merchant-bound resource IDs against the store
      await validateStoreResources(this.prisma, storeId, settings);

      const sectionInstance: GeneratedSectionInstance = {
        id: String(sec.id || `${type}_${randomUUID().slice(0, 8)}`),
        type,
        title: this.sanitizeText(sec.title) || def.label,
        settings,
        blocks,
      };
      if (typeof sec.hidden === 'boolean') sectionInstance.hidden = sec.hidden;
      if (this.sanitizeStyle(sec.style)) sectionInstance.style = this.sanitizeStyle(sec.style)!;
      if (layout) sectionInstance.layout = layout;

      validatedSections.push(sectionInstance);
    }

    if (validatedSections.length === 0) {
      return this.buildFallbackBlueprint(userPrompt, resolvedPageType);
    }

    const blueprint: PageBlueprint = {
      version: this.sanitizeText(pageData.version) || '2.0',
      page_type: resolvedPageType,
      title,
      purpose,
      sections: validatedSections,
    };

    const description = this.sanitizeText(pageData.description);
    if (description) blueprint.description = description;
    const slug = this.sanitizeText(pageData.slug);
    if (slug) blueprint.slug = slug.replace(/[^a-z0-9-_]/gi, '-').toLowerCase();
    if (pageData.seo && typeof pageData.seo === 'object') {
      blueprint.seo = {
        title: this.sanitizeText(pageData.seo.title) || undefined,
        description: this.sanitizeText(pageData.seo.description) || undefined,
        og_image: this.sanitizeText(pageData.seo.og_image) || undefined,
      };
    }
    if (pageData.settings && typeof pageData.settings === 'object') {
      blueprint.settings = {
        theme_preset: this.sanitizeText(pageData.settings.theme_preset) || undefined,
        primary_font: this.sanitizeText(pageData.settings.primary_font) || undefined,
        body_font: this.sanitizeText(pageData.settings.body_font) || undefined,
        bg_color: this.sanitizeColor(pageData.settings.bg_color),
        text_color: this.sanitizeColor(pageData.settings.text_color),
        accent_color: this.sanitizeColor(pageData.settings.accent_color),
      };
    }

    // Final Zod validation against the universal page blueprint schema
    const result = UniversalPageBlueprintSchema.safeParse(blueprint);
    if (!result.success) {
      this.logger.warn(`Universal page blueprint failed Zod validation, returning sanitized fallback.`);
      return this.buildFallbackBlueprint(userPrompt, resolvedPageType);
    }

    return result.data as PageBlueprint;
  }

  private sanitizeStyle(style: unknown): Record<string, Record<string, string | number>> | undefined {
    if (!style || typeof style !== 'object' || Array.isArray(style)) return undefined;
    const out: Record<string, Record<string, string | number>> = {};
    for (const [bp, map] of Object.entries(style as Record<string, unknown>)) {
      if (!['desktop', 'tablet', 'mobile', 'hover', 'active'].includes(bp)) continue;
      if (!map || typeof map !== 'object' || Array.isArray(map)) continue;
      const inner: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(map as Record<string, unknown>)) {
        if (!ALLOWED_STYLE_PROPERTIES.has(k)) continue;
        if (typeof v === 'number' && Number.isFinite(v)) inner[k] = v;
        else if (typeof v === 'string' && v.length < 500) inner[k] = v;
      }
      if (Object.keys(inner).length) out[bp] = inner;
    }
    return Object.keys(out).length ? out : undefined;
  }

  private sanitizeLayout(node: unknown): any {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return undefined;
    const raw = node as Record<string, unknown>;
    const type = normalizeComponentType(raw.type);
    if (!type) return undefined;

    const clean: Record<string, unknown> = { type };
    if (typeof raw.id === 'string' && raw.id.trim()) clean.id = raw.id.trim().slice(0, 80);
    if (typeof raw.name === 'string' && raw.name.trim()) clean.name = raw.name.trim().slice(0, 80);
    if (typeof raw.condition === 'string' && raw.condition.trim().length < 500 && !UNSAFE_PATTERN.test(raw.condition)) {
      clean.condition = raw.condition.trim();
    }

    const style = this.sanitizeStyle(raw.style);
    if (style) clean.style = style;

    const allowed = new Set(ALLOWED_PROPS[type]);
    const props: Record<string, unknown> = {};
    if (raw.props && typeof raw.props === 'object' && !Array.isArray(raw.props)) {
      for (const [k, v] of Object.entries(raw.props as Record<string, unknown>)) {
        if (!allowed.has(k)) continue;
        if (typeof v === 'string') props[k] = this.sanitizeText(v);
        else if (typeof v === 'number' || typeof v === 'boolean') props[k] = v;
      }
    }
    if (Object.keys(props).length) clean.props = props;

    if (raw.bindings && typeof raw.bindings === 'object' && !Array.isArray(raw.bindings)) {
      const bindings: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw.bindings as Record<string, unknown>)) {
        if (!allowed.has(k) || typeof v !== 'string' || v.length > 500) continue;
        bindings[k] = this.sanitizeText(v);
      }
      if (Object.keys(bindings).length) clean.bindings = bindings;
    }

    if (raw.repeater && typeof raw.repeater === 'object' && !Array.isArray(raw.repeater)) {
      const r = raw.repeater as Record<string, unknown>;
      const repeater: Record<string, unknown> = {};
      if (typeof r.itemsSource === 'string' && r.itemsSource.trim().length < 300) repeater.itemsSource = r.itemsSource.trim();
      if (typeof r.itemAlias === 'string' && /^[A-Za-z][A-Za-z0-9_]*$/.test(r.itemAlias)) repeater.itemAlias = r.itemAlias;
      if (typeof r.indexAlias === 'string' && /^[A-Za-z][A-Za-z0-9_]*$/.test(r.indexAlias)) repeater.indexAlias = r.indexAlias;
      if (typeof r.limit === 'number' && r.limit >= 1 && r.limit <= 100) repeater.limit = Math.floor(r.limit);
      if (repeater.itemsSource && repeater.itemAlias) clean.repeater = repeater;
    }

    if (Array.isArray(raw.children)) {
      const children = raw.children.map((c) => this.sanitizeLayout(c)).filter(Boolean);
      if (children.length) clean.children = children;
    }

    return clean;
  }

  private validateSectionSettings(
    rawSettings: Record<string, any>,
    def: SectionDefinition,
    sectionType?: string,
  ): Record<string, any> {
    const validated: Record<string, any> = {};

    for (const [key, fieldDef] of Object.entries(def.fields)) {
      const rawVal = rawSettings[key];

      if (rawVal === undefined || rawVal === null || rawVal === '') {
        if (fieldDef.type === 'image') {
          if (sectionType === 'hero' || sectionType === 'ecommerce_hero' || sectionType === 'split_hero' || sectionType === 'slider_hero' || sectionType === 'video_hero') {
            validated[key] = THEME_DEFAULT_IMAGES.hero;
          } else if (sectionType === 'image_banner') {
            validated[key] = THEME_DEFAULT_IMAGES.image_banner;
          } else if (sectionType === 'image_with_text') {
            validated[key] = THEME_DEFAULT_IMAGES.image_with_text;
          } else if (sectionType === 'collection_list') {
            validated[key] = THEME_DEFAULT_IMAGES.collection;
          } else if (sectionType === 'featured_product') {
            validated[key] = THEME_DEFAULT_IMAGES.product_spotlight;
          } else if (fieldDef.default) {
            validated[key] = fieldDef.default;
          }
        } else if (fieldDef.default !== undefined) {
          validated[key] = fieldDef.default;
        }
        continue;
      }

      switch (fieldDef.type) {
        case 'select': {
          const strVal = String(rawVal).trim();
          const validOption = fieldDef.options?.find((opt) => opt.value === strVal);
          if (validOption) {
            validated[key] = validOption.value;
          } else if (fieldDef.default !== undefined) {
            validated[key] = fieldDef.default;
          }
          break;
        }

        case 'number': {
          const num = Number(rawVal);
          if (!isNaN(num)) {
            validated[key] = String(num);
          } else if (fieldDef.default !== undefined) {
            validated[key] = String(fieldDef.default);
          }
          break;
        }

        case 'toggle': {
          if (typeof rawVal === 'boolean') {
            validated[key] = rawVal ? 'true' : 'false';
          } else {
            const lower = String(rawVal).toLowerCase().trim();
            validated[key] = lower === 'true' || lower === '1' || lower === 'yes' ? 'true' : 'false';
          }
          break;
        }

        case 'color': {
          const str = String(rawVal).trim();
          if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(str) || /^rgba?\(.+?\)$/i.test(str)) {
            validated[key] = str;
          } else if (fieldDef.default !== undefined) {
            validated[key] = fieldDef.default;
          }
          break;
        }

        case 'image': {
          const str = typeof rawVal === 'string' ? this.sanitizeText(rawVal) : '';
          if (str && (str.startsWith('http') || str.startsWith('/'))) {
            validated[key] = str;
          } else if (sectionType === 'hero' || sectionType === 'ecommerce_hero' || sectionType === 'split_hero' || sectionType === 'slider_hero' || sectionType === 'video_hero') {
            validated[key] = THEME_DEFAULT_IMAGES.hero;
          } else if (sectionType === 'image_banner') {
            validated[key] = THEME_DEFAULT_IMAGES.image_banner;
          } else if (sectionType === 'image_with_text') {
            validated[key] = THEME_DEFAULT_IMAGES.image_with_text;
          } else if (sectionType === 'collection_list') {
            validated[key] = THEME_DEFAULT_IMAGES.collection;
          } else if (sectionType === 'featured_product') {
            validated[key] = THEME_DEFAULT_IMAGES.product_spotlight;
          } else {
            validated[key] = fieldDef.default || '';
          }
          break;
        }

        case 'text':
        case 'richtext':
        case 'link': {
          validated[key] = this.sanitizeText(String(rawVal));
          break;
        }

        case 'video':
        case 'media':
        case 'resourcePicker':
        default: {
          if (typeof rawVal === 'string') {
            validated[key] = this.sanitizeText(rawVal);
          }
          break;
        }
      }
    }

    return validated;
  }

  private validateSectionBlocks(
    rawBlocks: any,
    def: SectionDefinition,
  ): GeneratedSectionBlock[] {
    if (!def.supportsBlocks || !Array.isArray(rawBlocks) || !def.blockSchema) {
      return [];
    }

    const validatedBlocks: GeneratedSectionBlock[] = [];

    for (const b of rawBlocks) {
      if (!b || typeof b !== 'object') continue;

      const rawBlockSettings = b.settings || b;
      const blockSettings: Record<string, any> = {};

      for (const [key, fieldDef] of Object.entries(def.blockSchema)) {
        const rawVal = rawBlockSettings[key];
        if (rawVal !== undefined && rawVal !== null) {
          if (fieldDef.type === 'select' && fieldDef.options) {
            const valid = fieldDef.options.find((o) => o.value === String(rawVal));
            blockSettings[key] = valid ? valid.value : fieldDef.default || '';
          } else if (fieldDef.type === 'toggle') {
            const lower = String(rawVal).toLowerCase().trim();
            blockSettings[key] = lower === 'true' || lower === '1' || lower === 'yes' ? 'true' : 'false';
          } else {
            blockSettings[key] = this.sanitizeText(String(rawVal));
          }
        } else if (fieldDef.default !== undefined) {
          blockSettings[key] = fieldDef.default;
        }
      }

      validatedBlocks.push({
        id: randomUUID().slice(0, 8),
        type: def.blockType || 'item',
        settings: blockSettings,
      });
    }

    return validatedBlocks;
  }

  private extractJson(rawText: string): any | null {
    if (!rawText || typeof rawText !== 'string') return null;

    let text = rawText.trim();

    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    try {
      return JSON.parse(text);
    } catch {
      // Continue to pattern extraction
    }

    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const candidate = text.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        const cleaned = candidate.replace(/,\s*([\]}])/g, '$1');
        try {
          return JSON.parse(cleaned);
        } catch {
          // Fall through
        }
      }
    }

    return null;
  }

  private sanitizeText(val?: string | null): string {
    if (!val || typeof val !== 'string') return '';
    return val
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/onerror\s*=/gi, '')
      .replace(/onload\s*=/gi, '')
      .trim();
  }

  private sanitizeColor(val?: unknown): string | undefined {
    if (typeof val !== 'string') return undefined;
    const str = val.trim();
    if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(str) || /^rgba?\(.+?\)$/i.test(str)) return str;
    return undefined;
  }

  private deriveTitleFromPrompt(prompt: string): string {
    const cleaned = prompt.replace(/[^\w\s]/gi, '').trim();
    if (!cleaned) return 'Custom Store Page';
    const words = cleaned.split(/\s+/).slice(0, 5).map((w) => w.charAt(0).toUpperCase() + w.slice(1));
    return words.join(' ');
  }

  private buildFallbackBlueprint(userPrompt: string, pageType?: PageType): PageBlueprint {
    return {
      version: '2.0',
      page_type: pageType || 'homepage',
      title: this.deriveTitleFromPrompt(userPrompt),
      purpose: 'Custom Storefront Page',
      sections: [
        {
          id: `hero_${randomUUID().slice(0, 8)}`,
          type: 'hero',
          title: 'Hero Banner',
          settings: {
            hero_theme: 'luxury',
            hero_layout: 'overlay',
            content_position: 'middle_center',
            alignment: 'center',
            title: this.deriveTitleFromPrompt(userPrompt),
            subtitle: 'Discover our new signature releases and curated essentials.',
            button_text: 'Shop Collection',
            button_link: '/collections',
          },
          blocks: [],
        },
        {
          id: `featured_products_${randomUUID().slice(0, 8)}`,
          type: 'featured_products',
          title: 'Featured Products',
          settings: {
            title: 'Trending Best-Sellers',
            subtitle: 'Our most coveted pieces this season',
            limit: '4',
            columns_desktop: '4',
            show_price: 'true',
          },
          blocks: [],
        },
        {
          id: `newsletter_${randomUUID().slice(0, 8)}`,
          type: 'newsletter',
          title: 'Newsletter Signup',
          settings: {
            heading: 'Join Our Community',
            subheading: 'Receive 15% off your first purchase.',
            button_text: 'Subscribe',
          },
          blocks: [],
        },
      ],
    };
  }
}
