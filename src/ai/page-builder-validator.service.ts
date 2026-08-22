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

export const THEME_DEFAULT_IMAGES = {
  hero: '/images/themes/theme_hero_luxury_banner.jpg',
  collection: '/images/themes/theme_collection_curation.jpg',
  image_banner: '/images/themes/theme_promo_banner.jpg',
  image_with_text: '/images/themes/theme_story_craftsmanship.jpg',
  product_spotlight: '/images/themes/theme_product_spotlight.jpg',
};

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

    const isWhatsAppAvailable = Boolean(whatsappConfig?.is_connected && whatsappConfig?.phone_number);

    const validatedSections: GeneratedSectionInstance[] = [];

    for (let i = 0; i < rawSections.length; i++) {
      const sec = rawSections[i];
      if (!sec || typeof sec !== 'object') continue;

      const type = String(sec.type || '').trim().toLowerCase();

      // Rule: Header, footer, and whatsapp are layout chrome, not body page sections
      if (type === 'header' || type === 'footer' || type === 'whatsapp') {
        continue;
      }

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

      const settings = this.validateSectionSettings(sec.settings || {}, def, type);
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

    // If no valid sections were generated, return complete 7+ section baseline
    if (validatedSections.length === 0) {
      return this.buildFallbackBlueprint(userPrompt);
    }

    // Ensure at least 7 sections by supplementing missing storefront layers
    const finalSections = this.ensureMinimumSevenSections(validatedSections, userPrompt);

    return {
      title,
      purpose,
      sections: finalSections,
    };
  }

  private ensureMinimumSevenSections(
    sections: GeneratedSectionInstance[],
    userPrompt: string,
  ): GeneratedSectionInstance[] {
    const types = new Set(sections.map((s) => s.type));

    const isHero = (t: string) =>
      ['hero', 'ecommerce_hero', 'split_hero', 'video_hero', 'slider_hero', 'minimal_hero', 'frame_scroll_hero'].includes(t);
    const isDiscovery = (t: string) => ['collection_list', 'instagram_stories'].includes(t);
    const isProducts = (t: string) => ['featured_products', 'featured_collection', 'featured_product', 'collection_products'].includes(t);
    const isPromoStory = (t: string) => ['image_banner', 'image_with_text', 'rich_text', 'video', 'model_3d', 'countdown'].includes(t);
    const isSocialProof = (t: string) => ['testimonials', 'product_reviews'].includes(t);
    const isFaq = (t: string) => t === 'faq';
    const isConversion = (t: string) => ['newsletter', 'contact_form'].includes(t);

    const result = [...sections];

    // Layer 1: Hero
    if (!result.some((s) => isHero(s.type))) {
      result.unshift({
        id: `hero_${randomUUID().slice(0, 8)}`,
        type: 'hero',
        title: 'Hero Banner',
        settings: {
          hero_theme: 'luxury',
          hero_layout: 'overlay',
          bg_image: THEME_DEFAULT_IMAGES.hero,
          title: this.deriveTitleFromPrompt(userPrompt),
          subtitle: 'Discover our new signature releases and curated essentials.',
          button_text: 'Explore Shop',
          button_link: '/collections',
        },
        blocks: [],
      });
    }

    // Layer 2: Discovery / Collections
    if (result.length < 7 && !result.some((s) => isDiscovery(s.type))) {
      const heroIdx = result.findIndex((s) => isHero(s.type));
      result.splice(heroIdx + 1, 0, {
        id: `collection_list_${randomUUID().slice(0, 8)}`,
        type: 'collection_list',
        title: 'Collection List',
        settings: { title: 'Browse by Collection' },
        blocks: [],
      });
    }

    // Layer 3: Main Products
    if (result.length < 7 && !result.some((s) => isProducts(s.type))) {
      result.splice(2, 0, {
        id: `featured_products_${randomUUID().slice(0, 8)}`,
        type: 'featured_products',
        title: 'Featured Products',
        settings: { title: 'Trending Best-Sellers', subtitle: 'Our most popular customer favorites' },
        blocks: [],
      });
    }

    // Layer 4: Brand Promo / Story
    if (result.length < 7 && !result.some((s) => isPromoStory(s.type))) {
      result.push({
        id: `image_banner_${randomUUID().slice(0, 8)}`,
        type: 'image_banner',
        title: 'Image Banner',
        settings: {
          heading: 'Exclusive Seasonal Offer',
          subheading: 'Limited Time Online',
          image: THEME_DEFAULT_IMAGES.image_banner,
          button_text: 'Shop Collection',
          button_link: '/collections',
        },
        blocks: [],
      });
    }

    // Layer 5: Storytelling with Text
    if (result.length < 7 && !types.has('image_with_text')) {
      result.push({
        id: `image_with_text_${randomUUID().slice(0, 8)}`,
        type: 'image_with_text',
        title: 'Image with Text',
        settings: {
          heading: 'Crafted with Integrity',
          subheading: 'Our Story',
          image: THEME_DEFAULT_IMAGES.image_with_text,
          content: '<p>Every item is designed with meticulous attention to detail and sustainable materials.</p>',
          button_text: 'Learn More',
        },
        blocks: [],
      });
    }

    // Layer 6: Testimonials
    if (result.length < 7 && !result.some((s) => isSocialProof(s.type))) {
      result.push({
        id: `testimonials_${randomUUID().slice(0, 8)}`,
        type: 'testimonials',
        title: 'Testimonials',
        settings: { title: 'Loved by Customers Worldwide' },
        blocks: [
          {
            id: randomUUID().slice(0, 8),
            type: 'testimonial',
            settings: {
              author_name: 'Elena R.',
              author_role: 'Verified Buyer',
              quote: '<p>Exceptional craftsmanship, luxurious packaging, and ultra-fast delivery!</p>',
              rating: '5',
            },
          },
        ],
      });
    }

    // Layer 7: FAQ
    if (result.length < 7 && !result.some((s) => isFaq(s.type))) {
      result.push({
        id: `faq_${randomUUID().slice(0, 8)}`,
        type: 'faq',
        title: 'FAQ',
        settings: { title: 'Frequently Asked Questions' },
        blocks: [
          {
            id: randomUUID().slice(0, 8),
            type: 'faq_item',
            settings: {
              q: 'How long does shipping take?',
              a: '<p>Orders typically arrive within 2-4 business days with tracking provided.</p>',
            },
          },
        ],
      });
    }

    // Layer 8: Newsletter
    if (result.length < 7 && !result.some((s) => isConversion(s.type))) {
      result.push({
        id: `newsletter_${randomUUID().slice(0, 8)}`,
        type: 'newsletter',
        title: 'Newsletter Signup',
        settings: {
          heading: 'Join Our Community',
          subheading: 'Sign up to receive 15% off your next purchase and exclusive early access.',
          button_text: 'Subscribe',
        },
        blocks: [],
      });
    }

    return result;
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
            title: this.deriveTitleFromPrompt(userPrompt),
            subtitle: 'Discover our new signature releases and curated essentials.',
            button_text: 'Shop Collection',
            button_link: '/collections',
          },
          blocks: [],
        },
        {
          id: `collection_list_${randomUUID().slice(0, 8)}`,
          type: 'collection_list',
          title: 'Collection List',
          settings: {
            title: 'Shop by Category',
            columns_desktop: '3',
            card_style: 'overlay',
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
            columns_mobile: '2',
            show_price: 'true',
            show_quick_view: 'true',
          },
          blocks: [],
        },
        {
          id: `image_banner_${randomUUID().slice(0, 8)}`,
          type: 'image_banner',
          title: 'Image Banner',
          settings: {
            heading: 'Limited Season Offer',
            subheading: 'Up to 40% off online & in-store',
            image: THEME_DEFAULT_IMAGES.image_banner,
            button_text: 'Claim Discount',
            button_link: '/collections',
          },
          blocks: [],
        },
        {
          id: `image_with_text_${randomUUID().slice(0, 8)}`,
          type: 'image_with_text',
          title: 'Image with Text',
          settings: {
            heading: 'Crafted with Purpose',
            subheading: 'Our Heritage',
            image: THEME_DEFAULT_IMAGES.image_with_text,
            content: '<p>Every product in our catalog is crafted using premium, sustainable materials designed to stand the test of time.</p>',
            button_text: 'Read Our Story',
          },
          blocks: [],
        },
        {
          id: `testimonials_${randomUUID().slice(0, 8)}`,
          type: 'testimonials',
          title: 'Testimonials',
          settings: {
            title: 'Loved by Over 50,000+ Customers',
            layout: 'slider',
          },
          blocks: [
            {
              id: randomUUID().slice(0, 8),
              type: 'testimonial',
              settings: {
                author_name: 'Elena R.',
                author_role: 'Verified Buyer',
                quote: '<p>Exceptional quality, luxurious finish, and incredibly prompt customer support!</p>',
                rating: '5',
              },
            },
          ],
        },
        {
          id: `faq_${randomUUID().slice(0, 8)}`,
          type: 'faq',
          title: 'FAQ',
          settings: {
            title: 'Frequently Asked Questions',
          },
          blocks: [
            {
              id: randomUUID().slice(0, 8),
              type: 'faq_item',
              settings: {
                q: 'What is your shipping policy?',
                a: '<p>We offer standard 3-5 business day delivery and expedited options at checkout.</p>',
              },
            },
            {
              id: randomUUID().slice(0, 8),
              type: 'faq_item',
              settings: {
                q: 'What is your return policy?',
                a: '<p>We provide a 30-day hassle-free return policy for all unused items in original packaging.</p>',
              },
            },
          ],
        },
        {
          id: `newsletter_${randomUUID().slice(0, 8)}`,
          type: 'newsletter',
          title: 'Newsletter Signup',
          settings: {
            heading: 'Join Our Community',
            subheading: 'Receive 15% off your first purchase and exclusive early access to new releases.',
            button_text: 'Subscribe',
          },
          blocks: [],
        },
      ],
    };
  }
}
