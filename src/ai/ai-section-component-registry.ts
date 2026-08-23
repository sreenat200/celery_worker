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
] as const;

export type AiSettingType = (typeof AI_SETTING_TYPES)[number];

export const LAYOUT_COMPONENT_TYPES = new Set<AiComponentType>([
  'container',
  'row',
  'column',
  'grid',
  'stack',
  'carousel',
]);

export const LEAF_COMPONENT_TYPES = new Set<AiComponentType>([
  'heading',
  'text',
  'image',
  'video',
  'button',
  'product',
  'collection',
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
  slideshow: 'carousel',
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
};

export const ALLOWED_PROPS: Record<AiComponentType, readonly string[]> = {
  container: ['role'],
  row: ['role', 'reverseOnMobile'],
  column: ['role'],
  grid: ['columns', 'tabletColumns', 'mobileColumns', 'role'],
  stack: ['role'],
  carousel: ['role', 'itemWidth'],
  heading: ['content', 'text', 'heading', 'title', 'variant'],
  text: ['content', 'text', 'subheading', 'description'],
  image: ['src', 'url', 'image', 'image_url', 'alt'],
  video: ['src', 'url', 'video', 'video_url', 'poster', 'autoplay', 'muted', 'controls', 'loop'],
  button: ['label', 'text', 'button_text', 'content', 'link', 'url', 'href', 'button_link'],
  product: ['title', 'price', 'image', 'src', 'url', 'link', 'button_label', 'showPrice', 'showAddToCart'],
  collection: ['title', 'image', 'src', 'url', 'link', 'itemCount'],
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

export const MAX_LAYOUT_DEPTH = 10;
export const MAX_LAYOUT_NODES = 64;
export const MAX_CHILDREN = 16;

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
- button: CTA. props: label (bind {{settings.button_text}}), link (bind {{settings.button_link}}).
  Keep compact: padding 12px 24px, fontWeight 600, borderRadius 8px, display inline-flex.
- product: product card. props: title, price, image, link, button_label, showAddToCart.
  Shows image, title, price, and Add to Cart when requested. Do not add reviews, badges, or countdown.
- collection: collection card. props: title, image, link.

SETTINGS TYPES (schema only): text, richtext, image, video, color, font, select, toggle, number, link, resourcePicker.

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
