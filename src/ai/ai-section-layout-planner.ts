export type LayoutDirection =
  | 'horizontal'
  | 'vertical'
  | 'grid'
  | 'split'
  | 'stacked'
  | 'carousel'
  | 'overlay'
  | 'banner';

export type MediaType = 'image' | 'video' | 'none';
export type MediaSide = 'left' | 'right' | 'none' | 'background';

export interface SectionLayoutPlan {
  purpose: string;
  layoutDirection: LayoutDirection;
  mediaType: MediaType;
  mediaSide: MediaSide;
  components: string[];
  columns: number | null;
  includeHeading: boolean;
  includeText: boolean;
  includeButton: boolean;
  scrolling: boolean;
  overlay: boolean;
  showProductPrice: boolean;
  showAddToCart: boolean;
  constraints: string[];
  suggestedTree: string;
  summary: string;
}

function has(text: string, ...patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

function detectColumns(text: string): number | null {
  const numeric = text.match(/\b(\d+)\s*[- ]?\s*(?:col(?:umn)?s?|grid)\b/);
  if (numeric) {
    const n = parseInt(numeric[1], 10);
    if (n >= 2 && n <= 6) return n;
  }
  if (/\bthree[-\s]?column\b|\b3[-\s]?column\b/.test(text)) return 3;
  if (/\bfour[-\s]?column\b|\b4[-\s]?column\b/.test(text)) return 4;
  if (/\btwo[-\s]?column\b|\b2[-\s]?column\b/.test(text)) return 2;
  return null;
}

function detectMediaSide(text: string, mediaType: MediaType): MediaSide {
  if (mediaType === 'none') return 'none';

  if (has(text, /(?:text|copy|content|heading) on the right/i)) return 'left';
  if (has(text, /(?:text|copy|content|heading) on the left/i)) return 'right';

  const mediaWord = mediaType === 'video' ? 'video' : 'image|photo|picture|media';
  if (has(text, new RegExp(`(?:${mediaWord})(?:\\s+\\w+){0,3}\\s+(?:on the right|to the right|right side)`, 'i'))) {
    return 'right';
  }
  if (has(text, new RegExp(`(?:${mediaWord})(?:\\s+\\w+){0,3}\\s+(?:on the left|to the left|left side)`, 'i'))) {
    return 'left';
  }
  if (has(text, /overlay|over the (image|video|media)|on top of the (image|video)/i)) {
    return 'background';
  }
  return 'left';
}

export function planSectionLayout(userPrompt: string): SectionLayoutPlan {
  const text = (userPrompt || '').trim();
  const lower = text.toLowerCase();

  const wantsVideo = has(lower, /\bvideos?\b|\bvideo section\b|\breel\b/);
  const wantsImage = has(lower, /\bimages?\b|\bphotos?\b|\bpictures?\b/);
  const wantsProduct = has(lower, /\bproducts?\b|\badd to cart\b|\bprices?\b/);
  const wantsCollection = has(lower, /\bcollections?\b/);
  const wantsCarousel = has(lower, /\bcarousel\b|\bslider\b|\bslideshow\b|\bsliding\b|horizontally scrolling|horizontal scroll|scrolling/);
  const wantsGrid = has(lower, /\bgrid\b|\bcolumns?\b|\b3-column\b|\bthree column\b/);
  const wantsOverlay = has(lower, /\boverlay\b|text over|over the image|on top of/);
  const wantsStack = has(lower, /\bstacked\b|\bmobile-first\b|\bvertical\b/);
  const wantsHorizontal = has(lower, /\bhorizontal\b|\bside by side\b|\bsplit\b|on the right|on the left/);
  const wantsBanner = has(lower, /\bbanner\b|\bpromo(?:tional)?\b|\bcta\b|\bhero\b/);
  const wantsButton = has(lower, /\bbutton\b|\bcta\b|\bshop now\b|\blearn more\b|\badd to cart\b|\bcall to action\b/);
  const wantsHeading = !has(lower, /\bno heading\b|\bwithout (a )?heading\b|\bwithout title\b/);
  const wantsText = !has(lower, /\bno (description|text|subheading)\b|\bwithout (description|text|copy)\b/);

  const mediaType: MediaType = wantsVideo ? 'video' : wantsImage ? 'image' : 'none';
  const mediaSide = detectMediaSide(lower, mediaType);
  const columns = detectColumns(lower);
  const scrolling = wantsCarousel;
  const overlay = wantsOverlay || mediaSide === 'background';
  const showProductPrice = wantsProduct && has(lower, /\bprices?\b|\bcost\b|\bamount\b/) || (wantsProduct && wantsGrid);
  const showAddToCart = has(lower, /\badd to cart\b|\batc\b|\bbuy\b/);

  let layoutDirection: LayoutDirection;
  if (scrolling) {
    layoutDirection = 'carousel';
  } else if (wantsGrid || (wantsProduct && columns)) {
    layoutDirection = 'grid';
  } else if (overlay) {
    layoutDirection = 'overlay';
  } else if (
    wantsHorizontal ||
    (mediaType !== 'none' && !wantsBanner && (mediaSide === 'left' || mediaSide === 'right'))
  ) {
    layoutDirection = mediaType !== 'none' ? 'split' : 'horizontal';
  } else if (wantsStack) {
    layoutDirection = 'stacked';
  } else if (wantsBanner && mediaType === 'none') {
    layoutDirection = 'banner';
  } else if (wantsProduct && !wantsGrid && !columns) {
    layoutDirection = 'split';
  } else if (wantsProduct || wantsCollection) {
    layoutDirection = wantsCollection && !wantsGrid ? 'carousel' : 'grid';
  } else {
    layoutDirection = 'vertical';
  }

  const includeHeading = wantsHeading && !wantsProduct || wantsBanner || wantsHorizontal || wantsStack || wantsCollection;
  const includeText = wantsText && !wantsProduct || wantsBanner || wantsHorizontal || wantsStack;
  const includeButton =
    wantsButton ||
    (layoutDirection === 'banner') ||
    ((layoutDirection === 'split' || layoutDirection === 'horizontal') && !wantsProduct);

  const components: string[] = ['container'];
  if (layoutDirection === 'carousel') components.push('carousel');
  else if (layoutDirection === 'grid') components.push('grid');
  else if (layoutDirection === 'split' || layoutDirection === 'horizontal') components.push('row', 'column');
  else if (layoutDirection === 'stacked' || layoutDirection === 'vertical' || layoutDirection === 'banner') {
    components.push('stack');
  } else if (layoutDirection === 'overlay') {
    components.push('container', 'stack');
  }

  if (mediaType === 'video') components.push('video');
  if (mediaType === 'image') components.push('image');
  if (wantsProduct) components.push('product');
  if (wantsCollection) components.push('collection');
  if (includeHeading) components.push('heading');
  if (includeText) components.push('text');
  if (includeButton && !wantsProduct) components.push('button');

  const uniqueComponents = Array.from(new Set(components));

  const constraints: string[] = [];
  if (wantsVideo) constraints.push('Use video, never substitute an image banner.');
  if (mediaSide === 'left') constraints.push('Media occupies the left side on desktop; text on the right.');
  if (mediaSide === 'right') constraints.push('Media occupies the right side on desktop; text on the left.');
  if (scrolling) constraints.push('Use carousel for horizontal scrolling. Do not use a static grid.');
  if (columns) constraints.push(`Use exactly ${columns} columns on desktop.`);
  if (wantsProduct) constraints.push('Do not add reviews, badges, countdowns, or unrelated product chrome.');
  if (wantsStack) constraints.push('Keep a stacked vertical layout on all breakpoints.');
  constraints.push('On mobile, stack horizontal panes (media above text) unless carousel scrolling was requested.');
  constraints.push('Do not invent features the user did not request.');

  const suggestedTree = buildSuggestedTree({
    layoutDirection,
    mediaType,
    mediaSide,
    columns,
    includeHeading,
    includeText,
    includeButton: includeButton && !wantsProduct,
    wantsProduct,
    wantsCollection,
    showAddToCart,
    overlay,
  });

  const purpose = derivePurpose({
    layoutDirection,
    mediaType,
    wantsProduct,
    wantsCollection,
    wantsBanner,
  });

  const summary = [
    `Purpose: ${purpose}.`,
    `Layout: ${layoutDirection}.`,
    mediaType !== 'none' ? `Media: ${mediaType} on ${mediaSide}.` : null,
    columns ? `Desktop columns: ${columns}.` : null,
    `Components: ${uniqueComponents.join(', ')}.`,
    `Mobile: ${scrolling ? 'keep horizontal scroll inside the section' : 'stack vertical, no page overflow'}.`,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    purpose,
    layoutDirection,
    mediaType,
    mediaSide,
    components: uniqueComponents,
    columns: columns || (layoutDirection === 'grid' ? 3 : null),
    includeHeading,
    includeText,
    includeButton: includeButton && !wantsProduct,
    scrolling,
    overlay,
    showProductPrice,
    showAddToCart,
    constraints,
    suggestedTree,
    summary,
  };
}

function derivePurpose(input: {
  layoutDirection: LayoutDirection;
  mediaType: MediaType;
  wantsProduct: boolean;
  wantsCollection: boolean;
  wantsBanner: boolean;
}): string {
  if (input.wantsProduct) return 'product-grid';
  if (input.wantsCollection) return 'collection-showcase';
  if (input.mediaType === 'video') return 'video-with-text';
  if (input.mediaType === 'image' && input.layoutDirection === 'split') return 'image-with-text';
  if (input.wantsBanner || input.layoutDirection === 'banner') return 'promotional-banner';
  if (input.layoutDirection === 'stacked') return 'stacked-content';
  if (input.layoutDirection === 'carousel') return 'horizontal-scroll';
  return 'custom-content';
}

function buildSuggestedTree(input: {
  layoutDirection: LayoutDirection;
  mediaType: MediaType;
  mediaSide: MediaSide;
  columns: number | null;
  includeHeading: boolean;
  includeText: boolean;
  includeButton: boolean;
  wantsProduct: boolean;
  wantsCollection: boolean;
  showAddToCart: boolean;
  overlay: boolean;
}): string {
  const contentKids: string[] = [];
  if (input.includeHeading) contentKids.push('heading');
  if (input.includeText) contentKids.push('text');
  if (input.includeButton) contentKids.push('button');

  if (input.wantsProduct) {
    const cols = input.columns || 3;
    return [
      'container',
      input.includeHeading ? '  heading' : null,
      input.includeText ? '  text' : null,
      `  grid (desktop: ${cols} columns, tablet: 2, mobile: 1)`,
      `    product x${cols} (image, title, price${input.showAddToCart ? ', Add to Cart button' : ''})`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (input.wantsCollection && (input.layoutDirection === 'carousel' || !input.columns)) {
    return [
      'container',
      input.includeHeading ? '  heading' : null,
      input.includeText ? '  text' : null,
      '  carousel (overflow-x auto, no page overflow)',
      '    collection x4 (image, title)',
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (input.wantsCollection) {
    const cols = input.columns || 3;
    return [
      'container',
      input.includeHeading ? '  heading' : null,
      `  grid (desktop: ${cols} columns)`,
      `    collection x${cols}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (input.layoutDirection === 'overlay' || input.overlay) {
    return [
      'container (background media + relative)',
      `  ${input.mediaType === 'video' ? 'video' : 'image'} (full-bleed background)`,
      '  stack (absolute overlay content)',
      ...contentKids.map((c) => `    ${c}`),
    ].join('\n');
  }

  if (input.layoutDirection === 'split' || input.layoutDirection === 'horizontal') {
    const media = input.mediaType === 'none' ? 'column (content)' : input.mediaType;
    const mediaFirst = input.mediaSide !== 'right';
    const left = mediaFirst ? media : 'column';
    const right = mediaFirst ? 'column' : media;
    return [
      'container',
      '  row (desktop: row, mobile: column)',
      `    ${left}${left === 'column' ? ` [${contentKids.join(', ')}]` : ' (flex 1, minWidth 0)'}`,
      `    ${right}${right === 'column' ? ` [${contentKids.join(', ')}]` : ' (flex 1, minWidth 0)'}`,
    ].join('\n');
  }

  return [
    'container',
    '  stack',
    ...contentKids.map((c) => `    ${c}`),
  ].join('\n');
}
