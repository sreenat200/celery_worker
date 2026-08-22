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

@Injectable()
export class PageBuilderValidator {
  private readonly logger = new Logger(PageBuilderValidator.name);

  constructor(private readonly prisma: PrismaService) {}

  async validateAndFormatBlueprint(
    rawText: string,
    storeId: number,
    userPrompt: string,
  ): Promise<PageBlueprint> {
    const rawJson = this.extractJson(rawText);
    if (!rawJson) {
      this.logger.warn(`Could not extract valid JSON from Qwen response. Fallback to default page structure.`);
      return this.buildFallbackBlueprint(userPrompt);
    }

    const pageData = rawJson.page || rawJson;
    const title = this.sanitizeText(pageData.title) || this.deriveTitleFromPrompt(userPrompt);
    const purpose = this.sanitizeText(pageData.purpose) || 'Custom Storefront Page';
    const rawSections = Array.isArray(pageData.sections) ? pageData.sections : [];

    // Query store settings / app configs to verify requiresApp rules
    const whatsappConfig = await this.prisma.whatsapp_config.findUnique({
      where: { store_id: Number(storeId) },
      select: { is_connected: true, phone_number: true },
    }).catch(() => null);

    const isWhatsAppAvailable = Boolean(whatsappConfig?.phone_number || whatsappConfig?.is_connected);

    const validatedSections: GeneratedSectionInstance[] = [];

    for (let i = 0; i < rawSections.length; i++) {
      const sec = rawSections[i];
      if (!sec || typeof sec !== 'object') continue;

      const type = String(sec.type || '').trim().toLowerCase();
      const def: SectionDefinition | undefined = THEME_SECTION_REGISTRY[type];

      // Rule: Section type must exist in the section registry
      if (!def) {
        this.logger.warn(`Skipping unsupported section type: "${type}"`);
        continue;
      }

      // Rule: Gated app sections check
      if (def.requiresApp === 'whatsapp' && !isWhatsAppAvailable) {
        // WhatsApp is allowed and included so merchant can configure phone in editor
      }

      const settings = this.validateSectionSettings(sec.settings || {}, def);
      const blocks = this.validateSectionBlocks(sec.blocks, def);

      const sectionInstance: GeneratedSectionInstance = {
        id: `${type}_${randomUUID().slice(0, 8)}`,
        type,
        title: def.label,
        settings,
        blocks,
      };

      validatedSections.push(sectionInstance);
    }

    // If no valid sections were generated, return standard baseline
    if (validatedSections.length === 0) {
      return this.buildFallbackBlueprint(userPrompt);
    }

    return {
      title,
      purpose,
      sections: validatedSections,
    };
  }

  private validateSectionSettings(
    rawSettings: Record<string, any>,
    def: SectionDefinition,
  ): Record<string, any> {
    const validated: Record<string, any> = {};

    for (const [key, fieldDef] of Object.entries(def.fields)) {
      const rawVal = rawSettings[key];

      if (rawVal === undefined || rawVal === null) {
        if (fieldDef.default !== undefined) {
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

        case 'text':
        case 'richtext':
        case 'link': {
          validated[key] = this.sanitizeText(String(rawVal));
          break;
        }

        case 'image':
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

    // 1. Strip markdown code block fences if present
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    // 2. Try direct JSON parse
    try {
      return JSON.parse(text);
    } catch {
      // Continue to pattern extraction
    }

    // 3. Match innermost/outermost json object block
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const candidate = text.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        // Try fixing unclosed trailing commas
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
    // Strip malicious script injection and protocol handlers
    return val
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/onerror\s*=/gi, '')
      .replace(/onload\s*=/gi, '')
      .trim();
  }

  private deriveTitleFromPrompt(prompt: string): string {
    const cleaned = prompt.replace(/[^\w\s]/gi, '').trim();
    if (!cleaned) return 'Custom Store Page';
    const words = cleaned.split(/\s+/).slice(0, 5).map((w) => w.charAt(0).toUpperCase() + w.slice(1));
    return words.join(' ');
  }

  private buildFallbackBlueprint(userPrompt: string): PageBlueprint {
    return {
      title: this.deriveTitleFromPrompt(userPrompt),
      purpose: 'Storefront Homepage',
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
            title: 'Discover Refined Luxury',
            subtitle: 'Explore our latest signature releases crafted with precision.',
            button_text: 'Shop Now',
          },
          blocks: [],
        },
        {
          id: `featured_products_${randomUUID().slice(0, 8)}`,
          type: 'featured_products',
          title: 'Featured Products',
          settings: {
            title: 'Featured Products',
            limit: '4',
            columns_desktop: '4',
            columns_mobile: '2',
            show_price: 'true',
            show_quick_view: 'true',
          },
          blocks: [],
        },
        {
          id: `collection_list_${randomUUID().slice(0, 8)}`,
          type: 'collection_list',
          title: 'Collection List',
          settings: {
            title: 'Shop by Collection',
            columns_desktop: '3',
            card_style: 'overlay',
          },
          blocks: [],
        },
        {
          id: `testimonials_${randomUUID().slice(0, 8)}`,
          type: 'testimonials',
          title: 'Testimonials',
          settings: {
            title: 'What Our Clients Say',
            layout: 'slider',
          },
          blocks: [
            {
              id: randomUUID().slice(0, 8),
              type: 'testimonial',
              settings: {
                author_name: 'Elena R.',
                author_role: 'Verified Buyer',
                quote: '<p>Exceptional quality and swift delivery. Highly recommended!</p>',
                rating: '5',
              },
            },
          ],
        },
        {
          id: `newsletter_${randomUUID().slice(0, 8)}`,
          type: 'newsletter',
          title: 'Newsletter Signup',
          settings: {
            heading: 'Stay Inspired',
            subheading: 'Join our inner circle for exclusive previews and offers.',
            button_text: 'Subscribe',
          },
          blocks: [],
        },
      ],
    };
  }
}
