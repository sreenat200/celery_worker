import { DESIGN_TOKENS } from './design-tokens';
import type { AstNode } from './ast-walker';

/**
 * Style Polisher — normalizes AI-generated blueprints into Shopify-quality
 * output by applying a deterministic sequence of style operations:
 *
 *   1. normalizeSpacing        — round/clamp padding, margin, gap to an 8px scale
 *   2. normalizeTypography     — clamp weights/sizes, add letter-spacing/line-height
 *   3. injectCardStyles        — rounded corners + subtle shadow + hover on cards
 *   4. injectButtonStyles      — 44px min-height, padding, radius, hover
 *   5. generateResponsiveStyles — derive mobile/tablet styles when missing
 */

const CARD_TYPES = new Set([
  'product',
  'collection',
  'product_card',
  'feature_card',
  'testimonial_item',
  'bento_cell',
  'icon',
  'product_price',
  'product_badge',
]);

const LAYOUT_TYPES = new Set([
  'container',
  'row',
  'column',
  'grid',
  'stack',
  'carousel',
  'accordion',
  'slider',
  'tabs',
  'bento',
  'masonry',
  'timeline',
  'sticky_split',
  'comparison_table',
]);

const GRID_PARENTS = new Set(['grid', 'carousel', 'masonry', 'bento']);

type StyleMap = Record<string, any>;

function getStyle(node: AstNode, bp: string): StyleMap {
  return (node && node.style && node.style[bp]) || {};
}

function setStyle(node: AstNode, bp: string, patch: StyleMap): AstNode {
  const style = { ...(node.style || {}) };
  style[bp] = { ...(style[bp] || {}), ...patch };
  return { ...node, style };
}

function toPx(value: any): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const px = trimmed.match(/^(-?\d+(?:\.\d+)?)px$/);
    if (px) return parseFloat(px[1]);
    const rem = trimmed.match(/^(-?\d+(?:\.\d+)?)rem$/);
    if (rem) return parseFloat(rem[1]) * 16;
  }
  return null;
}

function round8(value: number): number {
  return Math.round(value / 8) * 8;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundPxValue(value: any): any {
  const n = toPx(value);
  if (n === null) return value;
  const rounded = round8(n);
  return typeof value === 'number' ? rounded : `${rounded}px`;
}

const SPACING_PROPS = [
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
  'gap',
  'rowGap',
  'columnGap',
];

export function normalizeSpacing(node: AstNode, parent: AstNode | null = null): AstNode {
  const isRoot = !parent;
  const isGrid = node.type === 'grid';

  let next = node;

  // Round existing spacing values to the nearest multiple of 8.
  for (const bp of ['desktop', 'tablet', 'mobile']) {
    const style = getStyle(node, bp);
    if (!Object.keys(style).length) continue;
    const patch: StyleMap = {};
    for (const prop of SPACING_PROPS) {
      if (style[prop] !== undefined) patch[prop] = roundPxValue(style[prop]);
    }
    if (Object.keys(patch).length) next = setStyle(next, bp, patch);
  }

  // Section (root container) padding: clamp 48–96 desktop, 32–48 mobile.
  if (isRoot) {
    const dPad = toPx(getStyle(next, 'desktop').padding);
    const mPad = toPx(getStyle(next, 'mobile').padding);
    next = setStyle(next, 'desktop', { padding: dPad === null ? '64px' : `${clamp(dPad, 48, 96)}px` });
    next = setStyle(next, 'mobile', { padding: mPad === null ? '40px' : `${clamp(mPad, 32, 48)}px` });
  }

  // Grid gaps: default 24 desktop / 16 mobile, clamped 16–32 / 12–20.
  if (isGrid) {
    const dGap = toPx(getStyle(next, 'desktop').gap);
    const mGap = toPx(getStyle(next, 'mobile').gap);
    next = setStyle(next, 'desktop', { gap: dGap === null ? '24px' : `${clamp(dGap, 16, 32)}px` });
    next = setStyle(next, 'mobile', { gap: mGap === null ? '16px' : `${clamp(mGap, 12, 20)}px` });
  }

  return next;
}

function clampFontWeight(value: any): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

export function normalizeTypography(node: AstNode, _parent: AstNode | null = null): AstNode {
  let next = node;
  const desktop = getStyle(node, 'desktop');

  if (node.type === 'heading') {
    const patch: StyleMap = {};
    const weight = clampFontWeight(desktop.fontWeight);
    if (weight !== null) patch.fontWeight = String(clamp(weight, 500, 600));
    else patch.fontWeight = '600';

    const size = toPx(desktop.fontSize);
    if (size !== null && size >= 24) patch.letterSpacing = '-0.02em';

    const lineHeight = parseFloat(String(desktop.lineHeight || ''));
    if (!Number.isFinite(lineHeight)) patch.lineHeight = '1.2';
    else patch.lineHeight = String(clamp(lineHeight, 1.2, 1.3));

    next = setStyle(next, 'desktop', patch);
  } else if (node.type === 'text' || node.type === 'caption') {
    const patch: StyleMap = {};
    const size = toPx(desktop.fontSize);
    if (size !== null) {
      patch.fontSize = `${clamp(size, 14, 18)}px`;
    }
    const lineHeight = parseFloat(String(desktop.lineHeight || ''));
    if (!Number.isFinite(lineHeight)) patch.lineHeight = '1.6';
    else patch.lineHeight = String(clamp(lineHeight, 1.5, 1.6));

    const finalSize = toPx(patch.fontSize ?? desktop.fontSize);
    if (finalSize !== null && finalSize < 14) {
      patch.letterSpacing = '0.08em';
      patch.textTransform = 'uppercase';
    }
    next = setStyle(next, 'desktop', patch);
  }
  return next;
}

function isCardLike(node: AstNode, parent: AstNode | null): boolean {
  if (!node || !node.type) return false;
  if (CARD_TYPES.has(node.type)) return true;
  if ((node.type === 'container' || node.type === 'column') && Array.isArray(node.children) && node.children.length) {
    if (!parent) return false;
    return GRID_PARENTS.has(parent.type || '');
  }
  return false;
}

export function injectCardStyles(node: AstNode, parent: AstNode | null = null): AstNode {
  if (!isCardLike(node, parent)) return node;
  let next = node;
  const desktop = getStyle(node, 'desktop');

  const patch: StyleMap = {};
  if (desktop.borderRadius === undefined) patch.borderRadius = DESIGN_TOKENS.border_radius.md;
  if (desktop.boxShadow === undefined) patch.boxShadow = DESIGN_TOKENS.shadows.md;
  if (desktop.padding === undefined && desktop.paddingTop === undefined) patch.padding = DESIGN_TOKENS.spacing.default_card_padding;
  if (desktop.backgroundColor === undefined) patch.backgroundColor = DESIGN_TOKENS.colors.surface;

  next = setStyle(next, 'desktop', patch);

  const hover = getStyle(next, 'hover');
  if (!Object.keys(hover).length) {
    next = setStyle(next, 'hover', {
      transform: 'translateY(-2px)',
      boxShadow: DESIGN_TOKENS.shadows.hover,
      transition: DESIGN_TOKENS.transitions.normal,
    });
  }
  return next;
}

function hasBorder(style: StyleMap): boolean {
  return Boolean(style.border || style.borderColor || style.borderWidth);
}

export function injectButtonStyles(node: AstNode, _parent: AstNode | null = null): AstNode {
  if (node.type !== 'button') return node;
  let next = node;
  const desktop = getStyle(node, 'desktop');
  const patch: StyleMap = {};

  if (desktop.minHeight === undefined || (toPx(desktop.minHeight) ?? 0) < 40) patch.minHeight = '44px';
  if (desktop.padding === undefined && desktop.paddingTop === undefined) patch.padding = '12px 28px';
  if (desktop.borderRadius === undefined) patch.borderRadius = DESIGN_TOKENS.border_radius.md;
  if (desktop.fontWeight === undefined) patch.fontWeight = '600';

  const secondary = hasBorder(desktop);
  if (desktop.backgroundColor === undefined && !secondary) patch.backgroundColor = DESIGN_TOKENS.colors.primary;
  if (desktop.color === undefined && !secondary) patch.color = DESIGN_TOKENS.colors.text_inverse;
  if (secondary && desktop.backgroundColor === undefined) patch.backgroundColor = 'transparent';
  if (secondary && desktop.color === undefined) patch.color = DESIGN_TOKENS.colors.primary;
  if (secondary && desktop.border === undefined) patch.border = `1px solid ${DESIGN_TOKENS.colors.primary}`;

  next = setStyle(next, 'desktop', patch);

  const hover = getStyle(next, 'hover');
  if (!Object.keys(hover).length) {
    next = setStyle(next, 'hover', {
      opacity: '0.85',
      transform: 'translateY(-1px)',
    });
  }
  return next;
}

function countGridColumns(style: StyleMap): number | null {
  const template = style.gridTemplateColumns;
  if (typeof template !== 'string') return null;
  const m = template.match(/repeat\(\s*(\d+)/);
  if (m) return parseInt(m[1], 10);
  const parts = template.split(/\s+/).filter((p) => p && p !== 'minmax(0,' && p !== '1fr)');
  return parts.length || null;
}

export function generateResponsiveStyles(node: AstNode, parent: AstNode | null = null): AstNode {
  let next = node;
  const desktop = getStyle(node, 'desktop');
  const mobile = getStyle(node, 'mobile');
  const tablet = getStyle(node, 'tablet');

  const mobilePatch: StyleMap = {};

  if (node.type === 'grid' && mobile.gridTemplateColumns === undefined) {
    mobilePatch.gridTemplateColumns = 'minmax(0, 1fr)';
  }
  if (node.type === 'row' && mobile.flexDirection === undefined) {
    mobilePatch.flexDirection = 'column';
  }
  if (node.type === 'container' && !parent && mobile.padding === undefined) {
    mobilePatch.padding = '40px 16px';
  }
  if (node.type === 'heading' && mobile.fontSize === undefined) {
    const size = toPx(desktop.fontSize);
    if (size !== null) mobilePatch.fontSize = `${Math.max(24, Math.round(size * 0.6))}px`;
  }
  if (node.type === 'button' && mobile.width === undefined && parent && (parent.type === 'column' || parent.type === 'stack')) {
    mobilePatch.width = '100%';
  }

  if (Object.keys(mobilePatch).length) next = setStyle(next, 'mobile', mobilePatch);

  if (Object.keys(tablet).length === 0 && node.type === 'grid') {
    const cols = countGridColumns(desktop);
    if (cols !== null && cols > 2) {
      next = setStyle(next, 'tablet', {
        gridTemplateColumns: `repeat(${Math.max(2, Math.ceil(cols / 2))}, minmax(0, 1fr))`,
      });
    }
  }
  return next;
}

function processNode(node: AstNode, parent: AstNode | null): AstNode {
  let next = { ...node };
  next = normalizeSpacing(next, parent);
  next = normalizeTypography(next, parent);
  next = injectCardStyles(next, parent);
  next = injectButtonStyles(next, parent);
  next = generateResponsiveStyles(next, parent);
  if (Array.isArray(next.children)) {
    next.children = next.children
      .filter((c) => c && typeof c === 'object')
      .map((c) => processNode(c, next));
  }
  return next;
}

export function polishLayout(root: AstNode): AstNode {
  return processNode(root, null);
}

export function polishBlueprint(blueprint: any): any {
  if (!blueprint || typeof blueprint !== 'object') return blueprint;

  // Section blueprint: { layout }
  if (blueprint.layout && typeof blueprint.layout === 'object') {
    return { ...blueprint, layout: polishLayout(blueprint.layout) };
  }

  // Page blueprint: { sections: [{ layout? }] }
  if (Array.isArray(blueprint.sections)) {
    return {
      ...blueprint,
      sections: blueprint.sections.map((section: any) =>
        section && section.layout && typeof section.layout === 'object'
          ? { ...section, layout: polishLayout(section.layout) }
          : section,
      ),
    };
  }

  return blueprint;
}
