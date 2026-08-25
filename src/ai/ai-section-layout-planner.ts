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

export function detectRepeatRows(text: string): number | null {
  const t = (text || '').toLowerCase();
  if (/\binstagram\b|\bstory viewer\b|\bstories section\b/.test(t)) return null;
  const words: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6 };
  const m = t.match(/\b(two|three|four|five|six|2|3|4|5|6)\s+(?:story\s+)?rows\b/);
  if (!m) return null;
  const n = words[m[1]] || parseInt(m[1], 10);
  return n >= 2 && n <= 8 ? n : null;
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

  const wantsFaq = has(lower, /\bfaqs?\b|\baccordion\b|\bq\s*&\s*a\b|\bquestions? and answers?\b/);
  const wantsNewsletter = has(lower, /\bnewsletter\b|\bsubscribe\b|\bemail list\b|\bsign ?up (form|email)\b/);
  const wantsCountdown = has(lower, /\bcountdown\b|\btimer\b|\bsale ends\b|\bdeal ends\b/);
  const wantsStories = has(lower, /\binstagram stories\b|\bstories section\b|\bstory viewer\b|\binstagram\b/);
  const wants3d = has(lower, /\b3d\b|\bgltf\b|\bglb\b|\b3-d\b|\bthree[- ]d\b|\bmodel viewer\b/);
  const wantsContact = has(lower, /\bcontact form\b|\bget in touch\b|\benquiry form\b/) || (has(lower, /\bcontact\b/) && has(lower, /\bform\b/));
  const wantsIcons = has(lower, /\bfeature icons?\b|\btrust badges?\b|\busp\b|\bicon row\b/) || (has(lower, /\bicons?\b/) && has(lower, /\bfeatures?\b/));
  const wantsPage = has(lower, /\bpage content\b|\bcms\b|\bpage body\b/);
  const wantsTestimonials = has(lower, /\btestimonials?\b|\bcustomer quotes?\b/);
  const wantsReviews = !wantsTestimonials && (has(lower, /\bproduct reviews?\b|\bcustomer reviews?\b|\brating summary\b/) || (has(lower, /\breviews?\b/) && !has(lower, /\btestimonial/)));
  const wantsCollectionGrid = has(lower, /\bcollection products\b|\bfeatured collection\b|\bcollection grid\b|\bproducts? (from|in) (a |the )?collection\b/);
  const wantsSlider = has(lower, /\bslider hero\b|\bhero slider\b|\bslideshow\b|\bslide show\b/) || (has(lower, /\bslider\b/) && has(lower, /\bhero\b|slides?\b/));
  const wantsFrames = has(lower, /\bframe scroll\b|\bscroll hero\b|\bimage frames\b|\bpremium frames\b|\bscroll.?to.?frame\b/);
  const wantsPdp = has(lower, /\bproduct template\b|\bproduct (details?|page|pdp)\b|\bvariant selector\b|\bbuy now\b/);
  const wantsTabs = has(lower, /\btabs?\b|\btabbed\b/);
  const wantsFilters = has(lower, /\bfilters?\b|\bsort(?:ing)?\b/) && has(lower, /\bproduct|collection\b/);
  const wantsTable = has(lower, /\bcomparison table\b|\bcompare (?:plans|features|products)\b|\bpricing table\b|\bfeature table\b/);
  const wantsSticky = has(lower, /\bsticky\b/) && has(lower, /\bscroll|split|images?\b/);
  const wantsTimeline = has(lower, /\btimeline\b|\bmilestones?\b/);
  const wantsBento = has(lower, /\bbento\b/);
  const wantsMasonry = has(lower, /\bmasonry\b/);
  const wantsBeforeAfter = has(lower, /\bbefore\s*(and|&)\s*after\b|\bbefore\/after\b/);
  const wantsHotspot = has(lower, /\bhotspots?\b|\bimage pins?\b/);
  const wantsMarquee = has(lower, /\bmarquee\b|\bscrolling text\b|\bticker\b/);
  const wantsParallax = has(lower, /\bparallax\b/);
  const wantsRecommend = has(lower, /\brecommend(?:ed|ations?)?\b|\brelated products\b/);
  const wantsSpecs = has(lower, /\bspecifications?\b|\bproduct features\b/);
  const wantsNav = has(lower, /\bmulti[- ]level nav\b|\bnavigation menu\b|\bnested menu\b/);
  const wantsSizeGuide = has(lower, /\bsize guide\b|\bsize chart\b/);
  const wantsWhatsapp = has(lower, /\bwhatsapp\b/);
  const wantsShipping = has(lower, /\bshipping\b|\bcod\b|\bpincode\b/);
  const wantsVideo = has(lower, /\bvideos?\b|\bvideo section\b|\breel\b/) && !wantsStories && !wantsSlider;
  const wantsImage = has(lower, /\bimages?\b|\bphotos?\b|\bpictures?\b/);
  const wantsProduct = has(lower, /\bproducts?\b|\badd to cart\b|\bprices?\b/) && !wantsCollectionGrid && !wantsPdp && !wantsReviews;
  const repeatRows = detectRepeatRows(lower);
  const wantsCollectionBlocks =
    !repeatRows &&
    (has(lower, /\b\d+\s+(?:separate\s+)?collection sections\b/) ||
      (has(lower, /\beach section\b/) && has(lower, /\bcollection\b/)) ||
      (has(lower, /\bnecklaces?\b/) && has(lower, /\bearrings?\b/)));
  const wantsCollection = has(lower, /\bcollections?\b/) && !wantsCollectionGrid;
  const wantsCarousel = has(lower, /\bcarousel\b|\bhorizontally scrolling\b|\bhorizontal scroll\b|\bsliding\b/) && !wantsSlider;
  const wantsMobileCarousel = has(lower, /\bcarousel on mobile\b|\bhorizontal scroll on mobile\b/);
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
  if (repeatRows) {
    components.push('stack', 'row', 'column');
  } else if (layoutDirection === 'carousel') components.push('carousel');
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
  if (wantsFaq) components.push('accordion', 'accordion_item');
  if (wantsNewsletter) components.push('newsletter');
  if (wantsCountdown) components.push('countdown');
  if (wantsStories) components.push('stories');
  if (wants3d) components.push('model3d');
  if (wantsContact) components.push('contact_form');
  if (wantsIcons) components.push('icon');
  if (wantsPage) components.push('page_content');
  if (wantsReviews) components.push('reviews');
  if (wantsTestimonials) components.push('testimonial', 'testimonial_item');
  if (wantsCollectionGrid) components.push('collection_grid');
  if (wantsSlider) components.push('slider', 'slide');
  if (wantsFrames) components.push('frame_scroll');
  if (wantsPdp) components.push('product_detail');
  if (wantsTabs) components.push('tabs', 'tab');
  if (wantsFilters) components.push('filters');
  if (wantsTable) components.push('comparison_table', 'table_row');
  if (wantsSticky) components.push('sticky_split');
  if (wantsTimeline) components.push('timeline', 'timeline_item');
  if (wantsBento) components.push('bento', 'bento_cell');
  if (wantsMasonry) components.push('masonry');
  if (wantsBeforeAfter) components.push('before_after');
  if (wantsHotspot) components.push('hotspot', 'hotspot_pin');
  if (wantsMarquee) components.push('marquee');
  if (wantsParallax) components.push('parallax');
  if (wantsRecommend) components.push('recommend');
  if (wantsSpecs) components.push('specs');
  if (wantsNav) components.push('nav');
  if (wantsSizeGuide) components.push('size_guide');
  if (wantsWhatsapp) components.push('whatsapp');
  if (wantsShipping) components.push('shipping');
  if (includeHeading) components.push('heading');
  if (includeText) components.push('text');
  if (includeButton && !wantsProduct && !wantsNewsletter && !wantsContact) components.push('button');

  const uniqueComponents = Array.from(new Set(components));

  const constraints: string[] = [];
  if (wantsCollection && wantsButton) {
    constraints.push('Each collection card has its own live collection_N picker, CTA, border (collection_N_border_color / collection_N_border_width), and button chrome (collection_N_cta_border / collection_N_cta_radius).');
  }
  if (wantsProduct && has(lower, /\bquantity\b|\bqty\b/)) {
    constraints.push('Enable quantity selectors on product cards (enable_quantity / product_N_quantity). Bind Add to Cart to the selected quantity.');
  }
  if (includeButton && has(lower, /\b(width|border|hover)\b/)) {
    constraints.push('Style each button independently with button_N_width (auto, full, or px number), button_N_radius, button_N_border_color, button_N_border_width, button_N_hover_bg, button_N_hover_color, button_N_hover_border.');
  }
  if (wantsVideo) constraints.push('Use video, never substitute an image banner.');
  if (mediaSide === 'left') constraints.push('Media occupies the left side on desktop; text on the right.');
  if (mediaSide === 'right') constraints.push('Media occupies the right side on desktop; text on the left.');
  if (scrolling) constraints.push('Use carousel for horizontal scrolling. Do not use a static grid.');
  if (columns) constraints.push(`Use exactly ${columns} columns on desktop.`);
  if (wantsProduct) constraints.push('Do not add reviews, badges, countdowns, or unrelated product chrome.');
  if (wantsFaq) constraints.push('Use accordion + accordion_item. Do not fake FAQ with heading/text pairs.');
  if (wantsNewsletter) constraints.push('Use newsletter. Do not fake a signup with a button only.');
  if (wantsCountdown) constraints.push('Use countdown with end_date. Do not fake a timer with text.');
  if (wantsStories) constraints.push('Use stories. Do not substitute a carousel of images.');
  if (wants3d) constraints.push('Use model3d. Do not substitute an image.');
  if (wantsContact) constraints.push('Use contact_form. Do not fake fields with text nodes.');
  if (wantsIcons) constraints.push('Use icon nodes with allowlisted name values only. Per-icon backgrounds use icon_N_bg.');
  if (wantsPage) constraints.push('Use page_content. Bind a page resourcePicker. Do not invent page HTML.');
  if (wantsReviews) constraints.push('Use reviews with a product resourcePicker. Do not fake review cards with text.');
  if (wantsCollectionGrid) constraints.push('Use collection_grid with a collection resourcePicker. Enable grid_show_rating, grid_show_qty, and grid_show_atc when asked. Do not emit individual product nodes.');
  if (wantsSlider) constraints.push('Use slider + slide children. Do not use carousel.');
  if (wantsFrames) constraints.push('Use frame_scroll. Do not fake frames with a stack of images.');
  if (wantsPdp) constraints.push('Use product_detail. Do not use a product card.');
  if (wantsTabs) {
    constraints.push('Use tabs + tab children. Do not fake tabs with buttons.');
    if (wantsCollectionGrid || wantsCollection || wantsProduct) {
      constraints.push('Bind a separate tab_N_collection_id for each tab. Leave IDs empty. Each tab should contain collection_grid.');
      if (has(lower, /\brating|quantity|add to cart\b/)) {
        constraints.push('Set grid_show_rating, grid_show_qty, and grid_show_atc on the section.');
      }
    }
  }
  if (wantsFilters) constraints.push('Use filters with a collection resourcePicker.');
  if (wantsTable) constraints.push('Use comparison_table + table_row.');
  if (wantsSticky) constraints.push('Use sticky_split. First child is sticky content; remaining children are scrolling media.');
  if (wantsTimeline) constraints.push('Use timeline + timeline_item.');
  if (wantsBento) constraints.push('Use bento + bento_cell with colSpan/rowSpan.');
  if (wantsMasonry) constraints.push('Use masonry. Do not use equal-height grid.');
  if (wantsBeforeAfter) constraints.push('Use before_after with optional before_label and after_label. Do not use two images side by side.');
  if (wantsHotspot) constraints.push('Use hotspot + hotspot_pin with x/y percents.');
  if (wantsMarquee) constraints.push('Use marquee. Do not fake scrolling with carousel.');
  if (wantsParallax) constraints.push('Use parallax.');
  if (wantsRecommend) {
    constraints.push('Use recommend with product_1–product_6 pickers. Show rating, quantity, and Add to Cart when asked. Do not invent product IDs.');
    if (/\bgrid\b/.test(lower)) constraints.push('Set recommend_layout to grid.');
    else if (/\bcarousel\b/.test(lower)) constraints.push('Set recommend_layout to carousel.');
    constraints.push('Style recommend cards with recommend_card_bg, recommend_card_shadow, recommend_card_text, recommend_card_radius.');
  }
  if (wantsSpecs) constraints.push('Use specs with a product resourcePicker.');
  if (wantsNav) constraints.push('Use nav. Do not invent menu items.');
  if (wantsSizeGuide) constraints.push('Use size_guide. Do not invent store measurements.');
  if (wantsWhatsapp) constraints.push('Use whatsapp.');
  if (wantsShipping) constraints.push('Use shipping.');
  if (wantsStack) constraints.push('Keep a stacked vertical layout on all breakpoints.');
  if (wantsMobileCarousel) constraints.push('Use a product/collection grid on desktop and set mobile_layout to carousel.');
  constraints.push('On mobile, stack horizontal panes (media above text) unless carousel scrolling was requested.');
  constraints.push('Do not invent features the user did not request.');
  if (repeatRows) {
    constraints.push(`Compose ${repeatRows} independent stacked rows from primitives only: row + image + heading + text + button.`);
    constraints.push('Do not use stories, collection, or product nodes unless the user asked for them.');
    constraints.push('Each row is independently editable: image_N, caption_N, heading_N, text_N, button_N_text, button_N_link, button_N_bg, button_N_color, button_N_border_color, button_N_radius, row_N_position.');
    constraints.push('Alternate row_N_position left/right unless the user specified a single side.');
    constraints.push('On mobile each row stacks image above copy.');
  }
  if (wantsCollectionBlocks) {
    constraints.push('Emit ONE blueprint with a single container. Do not emit multiple JSON objects.');
    constraints.push('Build 4 stacked rows: image + heading + text + Shop Now button. Leave collection IDs empty.');
  }

  let suggestedTree = buildSuggestedTree({
    layoutDirection,
    mediaType,
    mediaSide,
    columns,
    includeHeading,
    includeText,
    includeButton: includeButton && !wantsProduct && !wantsNewsletter && !wantsContact,
    wantsProduct,
    wantsCollection,
    wantsFaq,
    wantsNewsletter,
    wantsCountdown,
    wantsStories,
    wants3d,
    wantsContact,
    wantsIcons,
    wantsPage,
    wantsReviews,
    wantsCollectionGrid,
    wantsSlider,
    wantsFrames,
    wantsPdp,
    wantsTabs,
    wantsFilters,
    wantsTable,
    wantsSticky,
    wantsTimeline,
    wantsBento,
    wantsMasonry,
    wantsBeforeAfter,
    wantsHotspot,
    wantsMarquee,
      wantsParallax,
      wantsRecommend,
      showAddToCart,
      overlay,
  });

  if (repeatRows) {
    suggestedTree = [
      'container',
      '  stack',
      `    row x${repeatRows} (alternate image left/right, mobile: column)`,
      '      image + caption_N',
      '      column',
      '        heading_N',
      '        text_N',
      '        button_N',
    ].join('\n');
  }
  if (wantsCollectionBlocks) {
    suggestedTree = [
      'container',
      '  stack',
      '    row x4 (desktop: image | copy, mobile: column)',
      '      image',
      '      column',
      '        heading',
      '        text',
      '        button (Shop Now)',
    ].join('\n');
  }

  const purpose = derivePurpose({
    layoutDirection,
    mediaType,
    wantsProduct,
    wantsCollection,
    wantsBanner,
    wantsFaq,
    wantsNewsletter,
    wantsCountdown,
    wantsStories,
    wants3d,
    wantsContact,
    wantsIcons,
    wantsPage,
    wantsReviews,
    wantsCollectionGrid,
    wantsSlider,
    wantsFrames,
    wantsPdp,
    wantsTabs,
    wantsFilters,
    wantsTable,
    wantsSticky,
    wantsTimeline,
    wantsBento,
    wantsMasonry,
    wantsBeforeAfter,
    wantsHotspot,
    wantsMarquee,
    wantsParallax,
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
  wantsFaq: boolean;
  wantsNewsletter: boolean;
  wantsCountdown: boolean;
  wantsStories: boolean;
  wants3d: boolean;
  wantsContact: boolean;
  wantsIcons: boolean;
  wantsPage: boolean;
  wantsReviews: boolean;
  wantsCollectionGrid: boolean;
  wantsSlider: boolean;
  wantsFrames: boolean;
  wantsPdp: boolean;
  wantsTabs: boolean;
  wantsFilters: boolean;
  wantsTable: boolean;
  wantsSticky: boolean;
  wantsTimeline: boolean;
  wantsBento: boolean;
  wantsMasonry: boolean;
  wantsBeforeAfter: boolean;
  wantsHotspot: boolean;
  wantsMarquee: boolean;
  wantsParallax: boolean;
}): string {
  if (input.wantsTabs) return 'tabs';
  if (input.wantsFilters) return 'filters';
  if (input.wantsTable) return 'comparison-table';
  if (input.wantsSticky) return 'sticky-split';
  if (input.wantsTimeline) return 'timeline';
  if (input.wantsBento) return 'bento';
  if (input.wantsMasonry) return 'masonry';
  if (input.wantsBeforeAfter) return 'before-after';
  if (input.wantsHotspot) return 'hotspot';
  if (input.wantsMarquee) return 'marquee';
  if (input.wantsParallax) return 'parallax';
  if (input.wantsPage) return 'page-content';
  if (input.wantsReviews) return 'product-reviews';
  if (input.wantsCollectionGrid) return 'collection-products';
  if (input.wantsSlider) return 'slider-hero';
  if (input.wantsFrames) return 'frame-scroll-hero';
  if (input.wantsPdp) return 'product-template';
  if (input.wantsFaq) return 'faq-accordion';
  if (input.wantsNewsletter) return 'newsletter';
  if (input.wantsCountdown) return 'countdown';
  if (input.wantsStories) return 'instagram-stories';
  if (input.wants3d) return '3d-model';
  if (input.wantsContact) return 'contact-form';
  if (input.wantsIcons) return 'feature-icons';
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
  wantsFaq: boolean;
  wantsNewsletter: boolean;
  wantsCountdown: boolean;
  wantsStories: boolean;
  wants3d: boolean;
  wantsContact: boolean;
  wantsIcons: boolean;
  wantsPage: boolean;
  wantsReviews: boolean;
  wantsCollectionGrid: boolean;
  wantsSlider: boolean;
  wantsFrames: boolean;
  wantsPdp: boolean;
  wantsTabs: boolean;
  wantsFilters: boolean;
  wantsTable: boolean;
  wantsSticky: boolean;
  wantsTimeline: boolean;
  wantsBento: boolean;
  wantsMasonry: boolean;
  wantsBeforeAfter: boolean;
  wantsHotspot: boolean;
  wantsMarquee: boolean;
  wantsParallax: boolean;
  wantsRecommend: boolean;
  showAddToCart: boolean;
  overlay: boolean;
}): string {
  const contentKids: string[] = [];
  if (input.includeHeading) contentKids.push('heading');
  if (input.includeText) contentKids.push('text');
  if (input.includeButton) contentKids.push('button');

  if (input.wantsFaq) {
    return ['container', '  heading', '  accordion', '    accordion_item x4 (question, answer)'].join('\n');
  }
  if (input.wantsNewsletter) {
    return ['container', '  heading', '  text', '  newsletter'].join('\n');
  }
  if (input.wantsCountdown) {
    return ['container', '  heading', '  countdown (end_date ISO)'].join('\n');
  }
  if (input.wantsStories) {
    return ['container', '  heading?', '  stories'].join('\n');
  }
  if (input.wants3d) {
    return ['container', '  heading?', '  model3d'].join('\n');
  }
  if (input.wantsContact) {
    return ['container', '  heading', '  text?', '  contact_form'].join('\n');
  }
  if (input.wantsIcons) {
    return ['container', '  heading?', '  grid (4 columns)', '    icon x4 (name, heading, description)'].join('\n');
  }
  if (input.wantsPage) {
    return ['container', '  page_content'].join('\n');
  }
  if (input.wantsReviews) {
    return ['container', '  heading?', '  reviews'].join('\n');
  }
  if (input.wantsCollectionGrid) {
    return ['container', '  heading?', '  collection_grid'].join('\n');
  }
  if (input.wantsSlider) {
    return ['container', '  slider', '    slide x3 (heading, description, image, button_text, button_link)'].join('\n');
  }
  if (input.wantsFrames) {
    return ['container', '  frame_scroll'].join('\n');
  }
  if (input.wantsPdp) {
    return ['container', '  product_detail'].join('\n');
  }
  if (input.wantsTabs) {
    return ['container', '  tabs', '    tab x4 (label + tab_N_collection_id + collection_grid)'].join('\n');
  }
  if (input.wantsFilters) {
    return ['container', '  heading?', '  filters'].join('\n');
  }
  if (input.wantsTable) {
    return ['container', '  heading?', '  comparison_table', '    table_row x4'].join('\n');
  }
  if (input.wantsSticky) {
    return ['container', '  sticky_split', '    stack (heading, text, button)', '    stack (images)'].join('\n');
  }
  if (input.wantsTimeline) {
    return ['container', '  heading?', '  timeline', '    timeline_item x4'].join('\n');
  }
  if (input.wantsBento) {
    return ['container', '  bento', '    bento_cell x6 (colSpan/rowSpan)'].join('\n');
  }
  if (input.wantsMasonry) {
    return ['container', '  masonry', '    image x6'].join('\n');
  }
  if (input.wantsBeforeAfter) {
    return ['container', '  heading?', '  before_after (before, after, before_label, after_label)'].join('\n');
  }
  if (input.wantsHotspot) {
    return ['container', '  hotspot', '    hotspot_pin x3 (x, y, heading)'].join('\n');
  }
  if (input.wantsMarquee) {
    return ['container', '  marquee'].join('\n');
  }
  if (input.wantsParallax) {
    return ['container', '  parallax', '    heading, text, button'].join('\n');
  }
  if (input.wantsRecommend) {
    return ['container', '  heading?', '  recommend (product_1–6, rating, quantity, Add to Cart, grid or carousel)'].join('\n');
  }

  if (input.wantsProduct) {
    const cols = input.columns || 3;
    return [
      'container',
      input.includeHeading ? '  heading' : null,
      input.includeText ? '  text' : null,
      `  grid (desktop: ${cols} columns, tablet: 2, mobile: 1)`,
      `    product x${cols} (image, title, price, quantity selector${input.showAddToCart ? ', Add to Cart button' : ''})`,
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
      '    collection x4 (image, title, description, Shop Now CTA)',
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
      `    collection x${cols} (image, title, Shop Now CTA)`,
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
