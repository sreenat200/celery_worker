export const AI_COMPONENT_TYPES = [
  'container',
  'row',
  'column',
  'grid',
  'stack',
  'heading',
  'text',
  'image',
  'video',
  'button',
  'product',
  'collection',
  'carousel',
  'accordion',
  'accordion_item',
  'newsletter',
  'countdown',
  'stories',
  'model3d',
  'contact_form',
  'icon',
  'page_content',
  'reviews',
  'collection_grid',
  'slider',
  'slide',
  'frame_scroll',
  'product_detail',
  'tabs',
  'tab',
  'filters',
  'comparison_table',
  'table_row',
  'sticky_split',
  'timeline',
  'timeline_item',
  'bento',
  'bento_cell',
  'masonry',
  'before_after',
  'hotspot',
  'hotspot_pin',
  'marquee',
  'parallax',
  'recommend',
  'specs',
  'nav',
  'size_guide',
  'whatsapp',
  'shipping',
  'testimonial',
  'testimonial_item',
] as const;

export type AiComponentType = (typeof AI_COMPONENT_TYPES)[number];

export const AI_SETTING_TYPES = [
  'text',
  'richtext',
  'image',
  'video',
  'color',
  'font',
  'select',
  'toggle',
  'number',
  'link',
  'resourcePicker',
  'datetime',
] as const;

export type AiSettingType = (typeof AI_SETTING_TYPES)[number];

export const LAYOUT_COMPONENT_TYPES = new Set<AiComponentType>([
  'container',
  'row',
  'column',
  'grid',
  'stack',
  'carousel',
  'accordion',
  'slider',
  'tabs',
  'tab',
  'comparison_table',
  'sticky_split',
  'timeline',
  'bento',
  'bento_cell',
  'masonry',
  'hotspot',
  'marquee',
  'parallax',
  'testimonial',
]);

export const LEAF_COMPONENT_TYPES = new Set<AiComponentType>([
  'heading',
  'text',
  'image',
  'video',
  'button',
  'product',
  'collection',
  'accordion_item',
  'newsletter',
  'countdown',
  'stories',
  'model3d',
  'contact_form',
  'icon',
  'page_content',
  'reviews',
  'collection_grid',
  'slide',
  'frame_scroll',
  'product_detail',
  'filters',
  'table_row',
  'timeline_item',
  'before_after',
  'hotspot_pin',
  'recommend',
  'specs',
  'nav',
  'size_guide',
  'whatsapp',
  'shipping',
  'testimonial_item',
]);

export const COMPONENT_ALIASES: Record<string, AiComponentType> = {
  section: 'container',
  wrapper: 'container',
  box: 'container',
  div: 'container',
  flex: 'row',
  'flex-row': 'row',
  'flex-col': 'column',
  col: 'column',
  vstack: 'stack',
  vstacking: 'stack',
  slider: 'carousel',
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  h5: 'heading',
  h6: 'heading',
  title: 'heading',
  p: 'text',
  paragraph: 'text',
  description: 'text',
  copy: 'text',
  img: 'image',
  picture: 'image',
  photo: 'image',
  a: 'button',
  cta: 'button',
  btn: 'button',
  'product-card': 'product',
  productcard: 'product',
  'collection-card': 'collection',
  collectioncard: 'collection',
  faq: 'accordion',
  faqs: 'accordion',
  collapse: 'accordion',
  faq_item: 'accordion_item',
  accordionitem: 'accordion_item',
  subscribe: 'newsletter',
  signup: 'newsletter',
  timer: 'countdown',
  countdown_timer: 'countdown',
  story: 'stories',
  instagram: 'stories',
  instagram_stories: 'stories',
  gltf: 'model3d',
  glb: 'model3d',
  '3d': 'model3d',
  '3d_model': 'model3d',
  model_3d: 'model3d',
  contact: 'contact_form',
  form: 'contact_form',
  feature: 'icon',
  feature_icon: 'icon',
  icons: 'icon',
  page: 'page_content',
  cms: 'page_content',
  page_body: 'page_content',
  review: 'reviews',
  product_reviews: 'reviews',
  collection_products: 'collection_grid',
  featured_collection: 'collection_grid',
  collection_product_grid: 'collection_grid',
  slideshow: 'slider',
  slider_hero: 'slider',
  hero_slider: 'slider',
  slide_item: 'slide',
  frame_scroll_hero: 'frame_scroll',
  frames: 'frame_scroll',
  product_template: 'product_detail',
  pdp: 'product_detail',
  product_page: 'product_detail',
  tab: 'tab',
  tabbed: 'tabs',
  ticker: 'marquee',
  compare: 'before_after',
  comparison: 'comparison_table',
  table: 'comparison_table',
  filter: 'filters',
  filter_bar: 'filters',
  sticky: 'sticky_split',
  masonry_grid: 'masonry',
  bento_grid: 'bento',
  pin: 'hotspot_pin',
  spots: 'hotspot',
  related: 'recommend',
  recommendations: 'recommend',
  related_products: 'recommend',
  specifications: 'specs',
  features: 'specs',
  navigation: 'nav',
  menu: 'nav',
  sizechart: 'size_guide',
  size_chart: 'size_guide',
  wa: 'whatsapp',
  shipping_cod: 'shipping',
  cod: 'shipping',
  quote: 'testimonial_item',
  quotes: 'testimonial',
  testimonials: 'testimonial',
  review_card: 'testimonial_item',
};

export const ALLOWED_PROPS: Record<AiComponentType, readonly string[]> = {
  container: ['role'],
  row: ['role', 'reverseOnMobile', 'image_position', 'slot'],
  column: ['role'],
  grid: ['columns', 'tabletColumns', 'mobileColumns', 'role'],
  stack: ['role', 'overlay', 'overlay_content'],
  carousel: ['role', 'itemWidth'],
  heading: ['content', 'text', 'heading', 'title', 'variant', 'slot'],
  text: ['content', 'text', 'subheading', 'description', 'slot'],
  image: ['src', 'url', 'image', 'image_url', 'alt', 'slot', 'caption'],
  video: ['src', 'url', 'video', 'video_url', 'poster', 'autoplay', 'muted', 'controls', 'loop', 'slot'],
  button: ['label', 'text', 'button_text', 'content', 'link', 'url', 'href', 'button_link', 'variant', 'bg', 'color', 'width', 'radius', 'borderColor', 'borderWidth', 'hoverBg', 'hoverColor', 'hoverBorder', 'slot'],
  product: ['title', 'price', 'image', 'src', 'url', 'link', 'button_label', 'showPrice', 'showAddToCart', 'slot'],
  collection: ['title', 'image', 'src', 'url', 'link', 'itemCount', 'description', 'cta', 'cta_link', 'cta_style', 'cta_visible', 'cta_bg', 'cta_color', 'cta_border', 'cta_radius', 'collection_id'],
  accordion: ['title', 'mode', 'icon'],
  accordion_item: ['question', 'answer', 'open'],
  newsletter: ['heading', 'description', 'placeholder', 'button_text', 'success_message', 'error_message'],
  countdown: ['title', 'end_date'],
  stories: ['heading'],
  model3d: ['src', 'url', 'model', 'model_url', 'heading'],
  contact_form: ['heading', 'button_text', 'success_message', 'error_message'],
  icon: ['name', 'heading', 'description', 'label', 'bg'],
  page_content: ['page', 'pageSlug', 'slug'],
  reviews: ['product_id', 'heading'],
  collection_grid: ['collection_id', 'limit', 'heading', 'columns'],
  slider: ['autoplay', 'interval'],
  slide: ['heading', 'description', 'image', 'video', 'button_text', 'button_link'],
  frame_scroll: ['heading', 'description'],
  product_detail: ['product_id'],
  tabs: ['active'],
  tab: ['label', 'collection_id', 'product_id', 'slot'],
  filters: ['collection_id', 'sort'],
  comparison_table: ['highlight'],
  table_row: ['label', 'c1', 'c2', 'c3', 'c4'],
  sticky_split: ['side'],
  timeline: ['orientation'],
  timeline_item: ['date', 'heading', 'description', 'image'],
  bento: ['columns'],
  bento_cell: ['colSpan', 'rowSpan', 'slot'],
  masonry: ['columns'],
  before_after: ['before', 'after', 'position', 'orientation', 'before_label', 'after_label', 'slot'],
  hotspot: ['src', 'image'],
  hotspot_pin: ['x', 'y', 'label', 'heading', 'description', 'product_id'],
  marquee: ['text', 'direction', 'speed'],
  parallax: ['src', 'image', 'speed'],
  recommend: ['product_id', 'limit', 'show_rating', 'show_atc', 'show_qty', 'layout'],
  specs: ['product_id'],
  nav: ['collections_label'],
  size_guide: ['heading'],
  whatsapp: ['phone', 'button_text', 'greeting', 'position'],
  shipping: ['heading', 'cod_message', 'button_text'],
  testimonial: ['heading'],
  testimonial_item: ['name', 'quote', 'rating', 'image', 'alt'],
};

export const ALLOWED_STYLE_PROPERTIES = new Set([
  'display',
  'flexDirection',
  'flexWrap',
  'alignItems',
  'justifyContent',
  'alignContent',
  'alignSelf',
  'gap',
  'rowGap',
  'columnGap',
  'gridTemplateColumns',
  'gridTemplateRows',
  'gridAutoFlow',
  'width',
  'height',
  'maxWidth',
  'maxHeight',
  'minWidth',
  'minHeight',
  'padding',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'margin',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'backgroundColor',
  'backgroundImage',
  'backgroundSize',
  'backgroundPosition',
  'backgroundRepeat',
  'color',
  'fontSize',
  'fontWeight',
  'fontFamily',
  'lineHeight',
  'letterSpacing',
  'textAlign',
  'textTransform',
  'textDecoration',
  'border',
  'borderRadius',
  'borderColor',
  'borderWidth',
  'borderStyle',
  'borderTop',
  'borderRight',
  'borderBottom',
  'borderLeft',
  'boxShadow',
  'opacity',
  'overflow',
  'overflowX',
  'overflowY',
  'objectFit',
  'objectPosition',
  'aspectRatio',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'inset',
  'zIndex',
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'order',
  'whiteSpace',
  'wordBreak',
  'boxSizing',
  'cursor',
  'pointerEvents',
  'scrollSnapType',
  'scrollSnapAlign',
  'flexShrink',
]);

export const UNSAFE_CONTENT_PATTERN =
  /<script|<\/script|javascript:|vbscript:|data:\s*text\/html|onerror\s*=|onclick\s*=|onload\s*=|expression\s*\(|-moz-binding|<\/style|<iframe|<object|<embed/i;

export const BINDING_PATTERN = /\{\{settings\.([a-zA-Z][a-zA-Z0-9_]*)\}\}/g;

export const MAX_LAYOUT_DEPTH = Number(process.env.AI_MAX_LAYOUT_DEPTH || 8);
export const MAX_LAYOUT_NODES = Number(process.env.AI_MAX_LAYOUT_NODES || 200);
export const MAX_CHILDREN = Number(process.env.AI_MAX_CHILDREN || 24);
export const MAX_SETTINGS = Number(process.env.AI_MAX_SETTINGS || 400);
export const MAX_SETTING_STRING = Number(process.env.AI_MAX_SETTING_STRING || 2000);
export const MAX_BLUEPRINT_CHARS = Number(process.env.AI_BLUEPRINT_MAX_CHARS || 120000);

export function normalizeComponentType(raw: unknown): AiComponentType | null {
  if (typeof raw !== 'string') return null;
  const key = raw.trim().toLowerCase();
  if ((AI_COMPONENT_TYPES as readonly string[]).includes(key)) {
    return key as AiComponentType;
  }
  return COMPONENT_ALIASES[key] || null;
}

export function getRegistryPromptContext(): string {
  return `COMPONENT REGISTRY (use ONLY these types)

LAYOUT
- container: outermost section wrapper. Use once as the root. Props: none required.
  Desktop: width 100%, maxWidth 1200px, margin 0 auto, padding 48px 24px, boxSizing border-box.
- row: horizontal flex layout. Use when content sits side-by-side on desktop.
  Desktop: display flex, flexDirection row, alignItems center, gap 32px, width 100%.
  Mobile: flexDirection column, alignItems stretch, gap 20px. First child stacks above the second.
- column: vertical flex group inside a row or as a content pane.
  Desktop: display flex, flexDirection column, gap 16px, flex 1, minWidth 0.
- grid: multi-column repeating items (products, cards).
  Desktop: display grid, gap 24px, gridTemplateColumns matching requested column count.
  Tablet: 2 columns when desktop has 3+. Mobile: 1 column (2 only if explicitly requested).
- stack: simple vertical list. Use for mobile-first or explicitly stacked content.
  Desktop: display flex, flexDirection column, gap 16px, width 100%.
- carousel: horizontal scrolling strip. Use ONLY when the user asks for scroll, slide, or carousel.
  Desktop+mobile: display flex, overflowX auto, gap 16px, scrollSnapType x mandatory.
  Children should have flex 0 0 auto and a fixed/min width. Never cause page-level overflow.

CONTENT
- heading: title. props: content (bind {{settings.heading}}), variant (h1-h3).
- text: body/description. props: content (bind {{settings.subheading}} or similar).
- image: responsive image. props: src (bind {{settings.image}}), alt.
  Always set width 100%, maxWidth 100%, height auto, objectFit cover, borderRadius 12px.
- video: embedded video. props: src (bind {{settings.video}}), autoplay, muted, controls.
  Always set width 100%, maxWidth 100%, height auto, borderRadius 12px, display block.
  NEVER replace a requested video with an image.
- button: CTA. props: label, link, variant, width (auto|full|px number), radius, borderColor, borderWidth, hoverBg, hoverColor, hoverBorder.
  Per-button settings: button_N_width, button_N_radius, button_N_border_color, button_N_border_width, button_N_hover_bg, button_N_hover_color, button_N_hover_border.
- product: product card. props: title, price, image, link, button_label, showAddToCart.
  Shows image, title, price, and Add to Cart when requested. Quantity via enable_quantity / product_N_quantity.
- collection: collection card. Bind live collection via collection_N. Per-card CTA, border (collection_N_border_color), button radius/border.
- accordion: FAQ list. children must be accordion_item. props: title.
- accordion_item: one Q&A. props: question, answer. Bind {{settings.faq_1_q}} / {{settings.faq_1_a}}.
- newsletter: email signup form. props: heading, placeholder, button_text.
- countdown: live sale timer. props: title, end_date (ISO datetime).
- stories: Instagram-style story rings. props: heading. Do not invent story media.
- model3d: 3D model viewer. props: src or model (bind {{settings.model}}).
- contact_form: name/email/message form. props: heading, button_text.
- icon: allowlisted icon only. props: name (truck|shield|refresh-cw|credit-card|headphones|star|heart|leaf|zap|award|clock|package|lock|globe|sparkles), heading, description, bg.
  Per-icon card background: icon_N_bg.
- page_content: store CMS page body. Bind {{settings.pageSlug}} via page resourcePicker. Never invent HTML.
- reviews: live product reviews + rating summary. Bind product via resourcePicker ({{settings.product_id}}).
- collection_grid: live products from one collection. Bind collection_id. Optional grid_show_rating, grid_show_qty, grid_show_atc.
- slider: multi-slide hero. children must be slide. props: autoplay, interval.
- slide: one slider slide. props: heading, description, image, video, button_text, button_link.
- frame_scroll: scroll-driven frame sequence. Overlay heading/description via settings. Do not invent frame URLs.
- product_detail: full product template (gallery, variants, quantity, add to cart). Bind product_id. Do not use product card.
- tabs / tab: tabbed content. tab props: label. Bind tab_N_collection_id per tab. Children of tab are the panel (usually collection_grid).
- filters: collection-bound product grid with sort/tag filters. Bind collection_id.
- comparison_table / table_row: feature comparison. table_row props: label, c1, c2, c3, c4.
- sticky_split: first child sticky, remaining children scroll.
- timeline / timeline_item: date, heading, description, image. props orientation vertical|horizontal.
- bento / bento_cell: uneven grid. bento_cell props: colSpan, rowSpan.
- masonry: variable-height image gallery. props: columns.
- before_after: interactive compare. props: before, after, position, orientation, before_label, after_label.
- hotspot / hotspot_pin: image pins. pin props: x, y (0-100), heading, description, product_id.
- marquee: scrolling text. props: text, direction, speed. Pause on hover is built-in.
- parallax: scroll background. props: src/image, speed. Overlay children.
- recommend: related products. Bind product_1–product_6. Optional rating, quantity, ATC. recommend_layout = carousel|grid. Card chrome: recommend_card_bg / recommend_card_shadow / recommend_card_text. Never invent IDs.
- specs: live product specifications from product_id.
- nav: store collections + pages menu. Never invent links.
- size_guide: editable size rows only (no invented measurements).
- whatsapp: WhatsApp chat button. props: phone, greeting, position.
- shipping: pincode / COD checker. Do not invent availability.

SETTINGS TYPES (schema only): text, richtext, image, video, color, font, select, toggle, number, link, resourcePicker, datetime.

BINDINGS
- Dynamic values MUST use {{settings.fieldName}}.
- Every referenced fieldName MUST exist in schema and defaultSettings.
- Expose only useful merchant-facing settings (content, media, colors, links). Do not expose raw CSS.

STYLE RULES
- Use camelCase CSS properties only (backgroundColor, flexDirection, fontSize, maxWidth).
- Include style.desktop AND style.mobile on every layout node that changes on small screens.
- Do not invent CSS files, classNames, or <style> tags.
- Avoid excessive padding, nested containers, and decorative borders.`;
}
