import {
  AI_COMPONENT_TYPES,
  LAYOUT_COMPONENT_TYPES,
  LEAF_COMPONENT_TYPES,
  type AiComponentType,
} from './ai-section-component-registry';
import type { PageType } from './universal-page-blueprint.schema';

export type { PageType };

/**
 * Three-Tier Capability Registry.
 *
 *  Tier 1 — Page types: which sections a page type may contain.
 *  Tier 2 — Section templates: composed entirely of tier-3 primitives
 *           (represented by registered section types in THEME_SECTION_REGISTRY).
 *  Tier 3 — Atomic primitives: the AI component registry, each carrying a
 *           capability declaration used to drive the Inspector.
 */

export interface PrimitiveCapability {
  supportsChildren: boolean;
  allowedChildTypes: AiComponentType[] | null; // null = unrestricted
  supportsRepeater: boolean;
  supportsResponsiveStyles: boolean;
  supportsHoverStyles: boolean;
  supportsConditionals: boolean;
  supportsCommerceBinding: boolean;
  allowedBindingTypes: Array<'product' | 'collection' | 'cart' | 'store'>;
}

const COMMERCE_TYPES: AiComponentType[] = [
  'product',
  'collection',
  'product_detail',
  'reviews',
  'collection_grid',
  'recommend',
  'specs',
  'product_price',
  'product_badge',
  'variant_selector',
  'quantity_selector',
  'product_gallery',
  'filters',
];

function capabilityFor(type: AiComponentType): PrimitiveCapability {
  const isLayout = LAYOUT_COMPONENT_TYPES.has(type);
  const isLeaf = LEAF_COMPONENT_TYPES.has(type);
  return {
    supportsChildren: isLayout || !isLeaf,
    allowedChildTypes: isLeaf ? [] : null,
    supportsRepeater: isLayout,
    supportsResponsiveStyles: true,
    supportsHoverStyles: isLeaf,
    supportsConditionals: true,
    supportsCommerceBinding: COMMERCE_TYPES.includes(type),
    allowedBindingTypes: COMMERCE_TYPES.includes(type) ? ['product', 'collection', 'store'] : [],
  };
}

export const PRIMITIVE_CAPABILITIES: Record<AiComponentType, PrimitiveCapability> =
  (() => {
    const map = {} as Record<AiComponentType, PrimitiveCapability>;
    for (const type of AI_COMPONENT_TYPES) map[type] = capabilityFor(type);
    return map;
  })();

export function getPrimitiveCapability(type: string): PrimitiveCapability | null {
  return (PRIMITIVE_CAPABILITIES as Record<string, PrimitiveCapability>)[type] ?? null;
}

// ── Tier 1: page types → allowed section types (registry keys) ───────────

export const PAGE_TYPE_ALLOWED_SECTIONS: Record<PageType, string[] | 'any'> = {
  homepage: [
    'hero', 'ecommerce_hero', 'split_hero', 'video_hero', 'slider_hero', 'minimal_hero', 'frame_scroll_hero',
    'collection_list', 'instagram_stories', 'featured_products', 'featured_collection', 'featured_product',
    'collection_products', 'image_banner', 'image_with_text', 'video', 'countdown', 'model_3d', 'rich_text',
    'testimonials', 'product_reviews', 'faq', 'newsletter', 'contact_form', 'announcement_bar',
  ],
  product_page: [
    'product_template', 'featured_product', 'product_reviews', 'recommendations', 'recommend',
    'related_products', 'testimonials', 'image_with_text', 'newsletter',
  ],
  collection_page: [
    'collection_list', 'collection_products', 'featured_collection', 'featured_products',
    'image_banner', 'rich_text', 'newsletter', 'filters',
  ],
  landing_page: [
    'hero', 'ecommerce_hero', 'split_hero', 'video_hero', 'countdown', 'image_banner',
    'featured_products', 'testimonials', 'newsletter', 'video', 'rich_text', 'contact_form',
  ],
  about_page: [
    'image_with_text', 'rich_text', 'testimonials', 'timeline', 'video', 'model_3d',
    'instagram_stories', 'newsletter', 'contact_form',
  ],
  contact_page: ['contact_form', 'image_with_text', 'faq', 'newsletter', 'rich_text'],
  faq_page: ['faq', 'image_with_text', 'newsletter', 'contact_form', 'rich_text'],
  campaign_page: [
    'hero', 'ecommerce_hero', 'countdown', 'featured_product', 'image_banner',
    'testimonials', 'newsletter', 'contact_form',
  ],
  custom_page: 'any',
};

export function getAllowedSectionsForPageType(pageType: PageType | undefined): string[] | 'any' {
  if (!pageType) return 'any';
  return PAGE_TYPE_ALLOWED_SECTIONS[pageType] ?? 'any';
}

// ── Page-type derivation from natural language ────────────────────────────

export function derivePageType(prompt: string): PageType {
  const t = (prompt || '').toLowerCase();

  if (/\b(faqs?|frequently asked questions|q\s*&\s*a)\b/.test(t)) return 'faq_page';
  if (/\b(contact|get in touch|enquiry|support page|reach us)\b/.test(t)) return 'contact_page';
  if (/\b(about|our story|who we are|mission|values|our team)\b/.test(t)) return 'about_page';
  if (/\b(collection|category|shop by|catalog page)\b/.test(t) && !/\bproduct detail\b/.test(t)) return 'collection_page';
  if (/\b(product page|product detail|pdp|product template|single product)\b/.test(t)) return 'product_page';
  if (/\b(landing|launch|campaign|flash sale|promo page|lead magnet)\b/.test(t)) return 'landing_page';
  if (/\b(campaign|black friday|sale page|promotion)\b/.test(t)) return 'campaign_page';
  if (/\b(home|homepage|storefront|landing home|main page)\b/.test(t)) return 'homepage';
  return 'custom_page';
}

export function pageTypeFromSections(sectionTypes: string[]): PageType {
  const set = new Set(sectionTypes.map((s) => String(s).toLowerCase()));
  if (set.has('product_template') || set.has('product_reviews')) return 'product_page';
  if (set.has('contact_form')) return 'contact_page';
  if (set.has('faq')) return 'faq_page';
  if (set.has('countdown') && !set.has('hero')) return 'campaign_page';
  return 'homepage';
}
