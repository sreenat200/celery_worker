/**
 * Convert AI layout AST / prompt into Universal Section + Block JSON
 * using registered Theme Editor section and block types only.
 * Never emits executable React.
 */

export const UNIVERSAL_SECTION_TYPES = new Set([
  'hero', 'image_banner', 'image_with_text', 'rich_text', 'video', 'video_hero',
  'faq', 'testimonials', 'featured_products', 'collection_list', 'newsletter',
  'countdown', 'about', 'split_hero', 'ai_custom', 'instagram_stories',
]);

export const UNIVERSAL_BLOCK_TYPES = new Set([
  'heading', 'text', 'rich_text', 'image', 'video', 'icon', 'button', 'link',
  'divider', 'spacer', 'product', 'product_card', 'collection', 'collection_card',
  'price', 'rating', 'quantity', 'add_to_cart', 'buy_now', 'countdown',
  'container', 'row', 'column', 'stack', 'grid', 'carousel', 'tabs',
  'bento', 'masonry', 'split', 'overlay',
  'faq_item', 'testimonial', 'story', 'product_addon',
]);

export const LAYOUT_BLOCK_TYPES = new Set([
  'container', 'row', 'column', 'stack', 'grid', 'carousel', 'tabs',
  'bento', 'masonry', 'split', 'overlay',
]);

const AST_TYPE_MAP: Record<string, string> = {
  accordion_item: 'faq_item',
  testimonial_item: 'testimonial',
  stories: 'story',
  model3d: 'image',
  collection_grid: 'collection_card',
  product_detail: 'product',
  product_price: 'price',
  product_gallery: 'image',
  quantity_selector: 'quantity',
  sticky_split: 'split',
  before_after: 'split',
  bento_cell: 'column',
  tab: 'column',
  slider: 'carousel',
  slide: 'column',
  accordion: 'stack',
};

export type UniversalBlock = {
  id: string;
  type: string;
  settings: Record<string, any>;
  styles: Record<string, any>;
  responsive: { desktop?: Record<string, any>; tablet?: Record<string, any>; mobile?: Record<string, any> };
  content: Record<string, any>;
  binding: Record<string, any>;
  children: UniversalBlock[];
  metadata?: Record<string, any>;
};

export type UniversalSection = {
  id: string;
  type: string;
  settings: Record<string, any>;
  styles: Record<string, any>;
  responsive: Record<string, any>;
  blocks: UniversalBlock[];
  children: UniversalBlock[];
  binding: Record<string, any>;
  metadata: Record<string, any>;
};

let seq = 0;
function nid(prefix: string) {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq.toString(36)}`;
}

function mapBlockType(raw: string): string | null {
  const t = String(raw || '').toLowerCase();
  const mapped = AST_TYPE_MAP[t] || t;
  return UNIVERSAL_BLOCK_TYPES.has(mapped) ? mapped : null;
}

function propsToSettings(type: string, props: Record<string, any> = {}, defaults: Record<string, any> = {}): Record<string, any> {
  const p = props || {};
  const resolve = (v: any) => {
    if (typeof v !== 'string') return v;
    const m = v.match(/^\{\{settings\.([^}]+)\}\}$/);
    if (!m) return v;
    return defaults[m[1]] ?? '';
  };
  const s: Record<string, any> = {};
  if (type === 'heading') s.text = resolve(p.content || p.text || p.heading) || 'Heading';
  else if (type === 'text' || type === 'rich_text') s.text = resolve(p.content || p.text) || '';
  else if (type === 'button') {
    s.label = resolve(p.label || p.text) || 'Shop Now';
    s.link = resolve(p.link || p.url) || '/collections';
    s.background = resolve(p.background || p.bg);
    s.color = resolve(p.color);
  } else if (type === 'image') {
    s.image = resolve(p.src || p.image || p.image_url);
    s.alt = resolve(p.alt) || '';
  } else if (type === 'video') s.video_url = resolve(p.src || p.video_url);
  else if (type === 'faq_item') {
    s.q = resolve(p.question || p.q) || 'Question';
    s.a = resolve(p.answer || p.a) || '<p>Answer</p>';
  } else if (type === 'testimonial') {
    s.quote = resolve(p.quote || p.content);
    s.author = resolve(p.name || p.author);
    s.rating = resolve(p.rating);
    s.image = resolve(p.image);
  } else if (type === 'product_card' || type === 'product') {
    s.product_id = resolve(p.product_id || p.product);
    s.title = resolve(p.title);
  } else if (type === 'collection_card' || type === 'collection') {
    s.collection_id = resolve(p.collection_id);
    s.title = resolve(p.title || p.name);
    s.image = resolve(p.image || p.image_url);
    s.link = resolve(p.link) || '/collections';
  } else if (type === 'link') {
    s.label = resolve(p.label || p.text);
    s.link = resolve(p.link || p.url);
  } else {
    for (const [k, v] of Object.entries(p)) {
      if (k === 'slot') continue;
      s[k] = resolve(v);
    }
  }
  return s;
}

function astToBlock(node: any, defaults: Record<string, any>): UniversalBlock | null {
  if (!node || typeof node !== 'object') return null;
  const type = mapBlockType(node.type);
  if (!type) return null;
  const kids = Array.isArray(node.children)
    ? node.children.map((c: any) => astToBlock(c, defaults)).filter(Boolean) as UniversalBlock[]
    : [];
  const style = node.style && typeof node.style === 'object' ? node.style : {};
  return {
    id: nid('blk'),
    type,
    settings: propsToSettings(type, node.props, defaults),
    styles: style.desktop || {},
    responsive: {
      desktop: style.desktop || {},
      tablet: style.tablet || {},
      mobile: style.mobile || {},
    },
    content: {},
    binding: {},
    children: LAYOUT_BLOCK_TYPES.has(type) ? kids : [],
    metadata: { source: 'ai' },
  };
}

function pickSectionType(prompt: string, blueprint: any): string {
  const t = String(prompt || '').toLowerCase();
  if (/\bfaqs?\b|\baccordion\b|\bq\s*&\s*a\b/.test(t)) return 'faq';
  if (/\btestimonials?\b/.test(t)) return 'testimonials';
  if (/\binstagram\b|\bstories\b/.test(t)) return 'instagram_stories';
  if (/\bproduct grid\b|\bfour-column product\b|\b4-column product\b|\bproducts from this store\b/.test(t)) {
    return 'featured_products';
  }
  if (/\bcollection (section|grid|cards?)\b/.test(t) && !/\brows\b/.test(t)) return 'collection_list';
  if (/\bvideo showcase\b|\bvideo\b/.test(t) && /\b(heading|description|cta|button)\b/.test(t) && !/\bproduct/.test(t)) {
    return 'video';
  }
  if (/\bhero\b/.test(t) && !/\b(faq|testimonial|product grid|bento|rows)\b/.test(t)) return 'hero';
  if (blueprint?.category === 'hero') return 'hero';
  return 'ai_custom';
}

function settingsFromBlueprint(bp: any): Record<string, any> {
  const d = { ...(bp?.defaultSettings || {}) };
  if (d.heading && !d.title) d.title = d.heading;
  if (d.padding_y && !d.padding_top) {
    d.padding_top = d.padding_y;
    d.padding_bottom = d.padding_y;
  }
  return d;
}

function faqBlocks(bp: any): UniversalBlock[] {
  const d = bp?.defaultSettings || {};
  const blocks: UniversalBlock[] = [];
  for (let i = 1; i <= 12; i += 1) {
    if (d[`faq_${i}_q`] == null && d[`faq_${i}_a`] == null) continue;
    blocks.push({
      id: nid('faq'),
      type: 'faq_item',
      settings: { q: d[`faq_${i}_q`] || 'Question', a: d[`faq_${i}_a`] || '<p>Answer</p>', open: false },
      styles: {},
      responsive: {},
      content: {},
      binding: {},
      children: [],
    });
  }
  if (blocks.length) return blocks;
  const fromAst = collectAst(bp?.layout, 'accordion_item').map((n) => astToBlock(n, d)).filter(Boolean) as UniversalBlock[];
  return fromAst;
}

function testimonialBlocks(bp: any): UniversalBlock[] {
  const d = bp?.defaultSettings || {};
  const blocks: UniversalBlock[] = [];
  for (let i = 1; i <= 12; i += 1) {
    if (d[`t_${i}_quote`] == null && d[`t_${i}_name`] == null) continue;
    blocks.push({
      id: nid('tst'),
      type: 'testimonial',
      settings: {
        quote: d[`t_${i}_quote`],
        author: d[`t_${i}_name`],
        rating: d[`t_${i}_rating`],
        image: d[`t_${i}_image`],
      },
      styles: {},
      responsive: {},
      content: {},
      binding: {},
      children: [],
    });
  }
  if (blocks.length) return blocks;
  return collectAst(bp?.layout, 'testimonial_item').map((n) => astToBlock(n, d)).filter(Boolean) as UniversalBlock[];
}

function collectAst(node: any, type: string, acc: any[] = []): any[] {
  if (!node || typeof node !== 'object') return acc;
  if (node.type === type) acc.push(node);
  if (Array.isArray(node.children)) node.children.forEach((c: any) => collectAst(c, type, acc));
  return acc;
}

function composeBlocks(bp: any): UniversalBlock[] {
  const d = bp?.defaultSettings || {};
  const layout = bp?.layout;
  if (!layout) return [];
  const rootKids = Array.isArray(layout.children) ? layout.children : [layout];
  let mapped = rootKids.map((n: any) => astToBlock(n, d)).filter(Boolean) as UniversalBlock[];
  while (
    mapped.length === 1 &&
    (mapped[0].type === 'container' || mapped[0].type === 'stack') &&
    mapped[0].children.length
  ) {
    mapped = mapped[0].children;
  }
  return mapped;
}

export function validateUniversalSection(section: UniversalSection): UniversalSection {
  if (!section || !UNIVERSAL_SECTION_TYPES.has(section.type)) {
    throw new Error(`Unsupported section type: ${section?.type}`);
  }
  const walk = (blocks: UniversalBlock[], depth: number): UniversalBlock[] => {
    if (depth > 8) return [];
    const out: UniversalBlock[] = [];
    for (const b of blocks || []) {
      if (!b || !UNIVERSAL_BLOCK_TYPES.has(b.type)) continue;
      const children = LAYOUT_BLOCK_TYPES.has(b.type) ? walk(b.children || [], depth + 1) : [];
      out.push({
        ...b,
        id: b.id || nid('blk'),
        settings: b.settings || {},
        styles: b.styles || {},
        responsive: b.responsive || {},
        content: b.content || {},
        binding: b.binding || {},
        children,
        metadata: { ...(b.metadata || {}), source: 'ai' },
      });
    }
    return out.slice(0, 80);
  };
  return {
    ...section,
    id: section.id || nid('sec'),
    settings: section.settings || {},
    styles: section.styles || {},
    responsive: section.responsive || {},
    binding: section.binding || {},
    children: [],
    blocks: walk(section.blocks || [], 0),
    metadata: { ...(section.metadata || {}), source: 'ai' },
  };
}

export function blueprintToUniversal(prompt: string, blueprint: any): UniversalSection {
  const type = pickSectionType(prompt, blueprint);
  const settings = settingsFromBlueprint(blueprint);
  let blocks: UniversalBlock[] = [];
  if (type === 'faq') blocks = faqBlocks(blueprint);
  else if (type === 'testimonials') blocks = testimonialBlocks(blueprint);
  else if (type === 'featured_products') {
    const ids: string[] = [];
    for (let i = 1; i <= 12; i += 1) {
      if (settings[`product_${i}`]) ids.push(String(settings[`product_${i}`]));
    }
    if (ids.length) settings.product_ids = ids;
    settings.limit = String(ids.length || settings.limit || 4);
    settings.columns_desktop = settings.columns_desktop || '4';
    blocks = [];
  } else if (type === 'hero' || type === 'video') {
    blocks = [];
    if (settings.heading && !settings.title) settings.title = settings.heading;
    if (settings.image_1 && !settings.bg_image) settings.bg_image = settings.image_1;
    if (settings.video_url || settings.video) settings.video_url = settings.video_url || settings.video;
  } else {
    blocks = composeBlocks(blueprint);
  }
  return validateUniversalSection({
    id: nid('sec'),
    type,
    settings,
    styles: {},
    responsive: {},
    blocks,
    children: [],
    binding: {},
    metadata: { name: blueprint?.name, source: 'ai', prompt: String(prompt || '').slice(0, 200) },
  });
}
