import type { SectionLayoutPlan } from './ai-section-layout-planner';
import { detectRepeatRows } from './ai-section-layout-planner';
import type { SectionStylePlan } from './ai-section-style-planner';

const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };

export function detectN(text: string, after: string, fallback = 0): number {
  const t = (text || '').toLowerCase();
  const m = t.match(new RegExp(`\\b(one|two|three|four|five|six|seven|eight|\\d+)\\s+(?:independent\\s+)?(?:${after})`));
  if (!m) return fallback;
  const n = WORDS[m[1]] || parseInt(m[1], 10);
  return Number.isFinite(n) && n >= 1 && n <= 12 ? n : fallback;
}

export function shouldCompose(prompt: string, plan: SectionLayoutPlan): boolean {
  const t = (prompt || '').toLowerCase();
  if (detectRepeatRows(t)) return true;
  if (/\bbento\b/.test(t)) return true;
  if (/\btabs?\b/.test(t) && /\b(collection|product)\b/.test(t)) return true;
  if (/\bvideo\b/.test(t) && /\bproduct/.test(t)) return true;
  if (/\bbefore\b/.test(t) && /\bafter\b/.test(t) && detectN(t, 'before|blocks?|comparisons?') >= 2) return true;
  if (/\bsticky\b/.test(t)) return true;
  if (/\bcompar/.test(t) && /\bproduct/.test(t)) return true;
  if (/\bcarousel on mobile\b|\bmobile.{0,24}carousel|\bhorizontal carousel mobile\b/.test(t)) return true;
  if (/\b2\s*[x×]\s*2\b/.test(t) && /\bcollection/.test(t)) return true;
  const flags = [
    plan.components.includes('product'),
    plan.components.includes('collection') || plan.components.includes('collection_grid'),
    plan.components.includes('testimonial'),
    plan.components.includes('accordion'),
    plan.components.includes('video'),
    plan.components.includes('icon'),
    plan.components.includes('recommend'),
  ].filter(Boolean).length;
  if (flags >= 3) return true;
  if (plan.components.includes('product') && (plan.components.includes('collection') || plan.components.includes('collection_grid'))) {
    return true;
  }
  if (/\bhero\b/.test(t) && /\b(faq|testimonial|product|collection|feature)/.test(t)) return true;
  if (detectN(t, 'cards?') >= 4) return true;
  if (/\b4-column\b|\b4 column\b|\bdesktop 4\b/.test(t)) return true;
  if (/\bsticky\b/.test(t) && /\b(accordion|faq|product|before|carousel)/.test(t)) return true;
  return false;
}

function field(schema: Record<string, any>, key: string, def: Record<string, any>) {
  schema[key] = def;
}

export function composeBlueprint(prompt: string, plan: SectionLayoutPlan, style: SectionStylePlan) {
  const t = (prompt || '').toLowerCase();
  const schema: Record<string, any> = {};
  const defaultSettings: Record<string, any> = {
    padding_y: '64',
    padding_x: '24',
    gap: '32',
    text_align: 'left',
    border_radius: '12',
    shadow: 'md',
    hover_effect: 'lift',
    heading_font_family: style.settings.heading_font_family || 'Inter',
    body_font_family: style.settings.body_font_family || 'Inter',
    ...style.settings,
  };
  const children: any[] = [];
  let button = 0;
  let heading = 0;
  let text = 0;
  let image = 0;

  const bentoN = /\bbento\b/.test(t) ? detectN(t, 'cells?|bento') || 6 : 0;
  const tabN = /\btabs?\b/.test(t) ? detectN(t, 'tabs?') || 3 : 0;
  const baAsked = /\bbefore\b/.test(t) && /\bafter\b/.test(t);
  let baN = baAsked ? Math.max(detectN(t, 'before|blocks?|comparisons?'), 1) : 0;
  const sticky = /\bsticky\b/.test(t);
  const storyN = sticky
    ? detectN(t, 'story|items?|rows?') || 4
    : detectRepeatRows(t) || 0;
  const compare = /\bcompar/.test(t) && /\bproduct/.test(t);
  const video = /\bvideo\b/.test(t) || plan.components.includes('video');
  const overlay = /\boverlay\b/.test(t);
  let faq = /\bfaqs?\b/.test(t) || plan.components.includes('accordion');
  const testi = /\btestimonial/.test(t) || plan.components.includes('testimonial');
  const icons = /\bfeature/.test(t) || plan.components.includes('icon');
  const mobileCarousel = /\bcarousel on mobile\b|\bmobile.{0,24}carousel|\bhorizontal carousel mobile\b/.test(t);
  const grid2x2 = /\b2\s*[x×]\s*2\b/.test(t);
  let collectionN = detectN(t, 'collection cards?|collections?');
  if (grid2x2 && /collection/.test(t)) collectionN = Math.max(collectionN, 4);
  if (!collectionN && plan.components.includes('collection')) collectionN = 4;
  let productN = detectN(t, 'products?');
  if (compare) productN = Math.max(productN, 4);
  if (/\bone live product\b|\ba live product\b/.test(t)) productN = 1;
  if (!productN && plan.components.includes('product') && !compare && !video) productN = 3;
  const collectionGrid = plan.components.includes('collection_grid') && !grid2x2 && collectionN <= 1;
  const productCarousel = /\bproduct carousel\b|\blive product carousel\b/.test(t) || (video && /\bproduct/.test(t));

  if (/\b3 columns?\b|\bthree[-\s]?column/.test(t)) defaultSettings.columns = '3';
  if (grid2x2) defaultSettings.columns = '2';
  if (/\b2 columns? tablet\b|\btablet.{0,16}2\b/.test(t)) defaultSettings.tablet_columns = '2';
  if (mobileCarousel) defaultSettings.mobile_layout = 'carousel';
  if (compare) {
    defaultSettings.compare_show_atc = 'true';
    defaultSettings.compare_show_buy = 'true';
    defaultSettings.compare_show_qty = 'true';
    defaultSettings.show_rating = 'true';
  }

  const pushHeading = (label: string, value: string) => {
    heading += 1;
    const n = heading;
    field(schema, `heading_${n}`, { type: 'text', label, default: value });
    defaultSettings[`heading_${n}`] = value;
    return { type: 'heading', props: { slot: n, content: `{{settings.heading_${n}}}` } };
  };
  const pushText = (label: string, value: string) => {
    text += 1;
    const n = text;
    field(schema, `text_${n}`, { type: 'richtext', label, default: value });
    defaultSettings[`text_${n}`] = value;
    return { type: 'text', props: { slot: n, content: `{{settings.text_${n}}}` } };
  };
  const pushImage = (label: string) => {
    image += 1;
    const n = image;
    field(schema, `image_${n}`, { type: 'image', label, default: '' });
    field(schema, `caption_${n}`, { type: 'text', label: `${label} caption`, default: '' });
    defaultSettings[`caption_${n}`] = '';
    return { type: 'image', props: { slot: n, src: `{{settings.image_${n}}}`, caption: `{{settings.caption_${n}}}` } };
  };
  const pushButton = (label: string, value: string) => {
    button += 1;
    const n = button;
    field(schema, `button_${n}_text`, { type: 'text', label: `${label} label`, default: value });
    field(schema, `button_${n}_link`, { type: 'link', label: `${label} link`, default: '/collections' });
    field(schema, `button_${n}_bg`, { type: 'color', label: `${label} color`, default: '#111827' });
    field(schema, `button_${n}_color`, { type: 'color', label: `${label} text`, default: '#ffffff' });
    field(schema, `button_${n}_border_color`, { type: 'color', label: `${label} border`, default: '#111827' });
    field(schema, `button_${n}_radius`, { type: 'number', label: `${label} radius`, default: '8' });
    defaultSettings[`button_${n}_text`] = value;
    defaultSettings[`button_${n}_link`] = n === 2 ? '/about' : '/collections';
    defaultSettings[`button_${n}_bg`] = n === 1 ? (defaultSettings.button_1_bg || '#d4af37') : '#0a1628';
    defaultSettings[`button_${n}_color`] = n === 1 ? '#0a1628' : '#ffffff';
    defaultSettings[`button_${n}_radius`] = '8';
    return { type: 'button', props: { slot: n, label: `{{settings.button_${n}_text}}`, link: `{{settings.button_${n}_link}}` } };
  };

  if (video) {
    const media = { type: 'video', props: { src: '{{settings.video}}', poster: '{{settings.poster}}' } };
    field(schema, 'video', { type: 'video', label: 'Video', default: '' });
    field(schema, 'poster', { type: 'image', label: 'Poster', default: '' });
    const copy = [
      pushHeading('Heading', defaultSettings.heading || 'Watch'),
      pushText('Description', defaultSettings.subheading || ''),
      {
        type: 'stack',
        children: [pushButton('Button 1', 'Shop Now'), pushButton('Button 2', 'Learn More')],
      },
    ];
    if (overlay || /\bhero\b|\bfull-width\b/.test(t)) {
      defaultSettings.heading_color = defaultSettings.heading_color || '#f5f0e8';
      defaultSettings.text_color = defaultSettings.text_color || '#f5f0e8';
      defaultSettings.overlay_opacity = defaultSettings.overlay_opacity || '45';
      children.push({
        type: 'stack',
        style: { desktop: { position: 'relative', width: '100%' } },
        children: [
          media,
          {
            type: 'stack',
            props: { overlay: true },
            style: {
              desktop: {
                position: 'absolute',
                inset: '0',
                zIndex: 2,
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                gap: '16px',
                padding: '48px 24px',
                color: '#f5f0e8',
              },
            },
            children: copy,
          },
        ],
      });
    } else {
      children.push({ type: 'row', children: [media, { type: 'column', children: copy }] });
    }
    if (productCarousel || productN) {
      const count = Math.max(productN, 4);
      children.push({
        type: 'carousel',
        children: Array.from({ length: count }, (_, i) => ({ type: 'product', props: { slot: i + 1 } })),
      });
      for (let i = 1; i <= count; i += 1) {
        field(schema, `product_${i}`, { type: 'resourcePicker', label: `Product ${i}`, resourceType: 'product' });
      }
      defaultSettings.enable_quantity = true;
      defaultSettings.show_rating = true;
      productN = 0;
    }
  }

  if (storyN && !sticky) {
    for (let i = 1; i <= storyN; i += 1) {
      const pos = i % 2 === 0 ? 'right' : 'left';
      field(schema, `row_${i}_position`, {
        type: 'select',
        label: `Row ${i} image`,
        default: pos,
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Right', value: 'right' },
        ],
      });
      defaultSettings[`row_${i}_position`] = pos;
      children.push({
        type: 'row',
        props: { slot: i },
        children: [pushImage(`Row ${i} image`), { type: 'column', children: [pushHeading(`Row ${i} heading`, `Story ${i}`), pushText(`Row ${i} text`, ''), pushButton(`Row ${i} button`, 'Shop Now')] }],
      });
    }
  }

  if (sticky) {
    const items: any[] = Array.from({ length: storyN || 3 }, (_, i) => ({
      type: 'stack',
      children: [pushImage(`Story ${i + 1} image`), pushHeading(`Story ${i + 1} heading`, `Story ${i + 1}`), pushText(`Story ${i + 1} text`, ''), pushButton(`Story ${i + 1} button`, 'Shop Now')],
    }));
    if (productCarousel || productN) {
      const count = Math.max(productN, 4);
      items.push({
        type: 'carousel',
        children: Array.from({ length: count }, (_, i) => ({ type: 'product', props: { slot: i + 1 } })),
      });
      for (let i = 1; i <= count; i += 1) {
        field(schema, `product_${i}`, { type: 'resourcePicker', label: `Product ${i}`, resourceType: 'product' });
      }
      productN = 0;
    }
    if (faq) {
      const count = detectN(t, 'questions?|faqs?') || 4;
      items.push({
        type: 'accordion',
        children: Array.from({ length: count }, (_, i) => ({ type: 'accordion_item', props: { slot: i + 1 } })),
      });
      faq = false;
    }
    if (baN) {
      items.push({
        type: 'before_after',
        props: { slot: 1, before: '{{settings.before_1}}', after: '{{settings.after_1}}' },
      });
      field(schema, 'before_1', { type: 'image', label: 'Before image', default: '' });
      field(schema, 'after_1', { type: 'image', label: 'After image', default: '' });
      baN = 0;
    }
    children.push({
      type: 'sticky_split',
      children: [pushImage('Sticky image'), { type: 'stack', children: items }],
    });
  }

  if (bentoN) {
    const cells = Array.from({ length: bentoN }, (_, i) => {
      const n = i + 1;
      field(schema, `cell_${n}_bg`, { type: 'color', label: `Cell ${n} background`, default: '' });
      field(schema, `cell_${n}_color`, { type: 'color', label: `Cell ${n} text`, default: '' });
      field(schema, `cell_${n}_radius`, { type: 'number', label: `Cell ${n} radius`, default: '16' });
      field(schema, `cell_${n}_colspan`, { type: 'number', label: `Cell ${n} col span`, default: n % 3 === 1 ? '2' : '1' });
      defaultSettings[`cell_${n}_radius`] = '16';
      defaultSettings[`cell_${n}_colspan`] = n % 3 === 1 ? '2' : '1';
      return {
        type: 'bento_cell',
        props: { slot: n, colSpan: n % 3 === 1 ? 2 : 1 },
        children: [pushImage(`Cell ${n} image`), pushHeading(`Cell ${n} heading`, `Cell ${n}`), pushText(`Cell ${n} text`, ''), pushButton(`Cell ${n} button`, 'Shop Now')],
      };
    });
    children.push({ type: 'bento', children: cells });
  }

  if (tabN) {
    const tabs = Array.from({ length: tabN }, (_, i) => {
      const n = i + 1;
      field(schema, `tab_${n}_label`, { type: 'text', label: `Tab ${n}`, default: `Tab ${n}` });
      field(schema, `tab_${n}_collection_id`, { type: 'resourcePicker', label: `Tab ${n} collection`, resourceType: 'collection' });
      field(schema, `tab_${n}_product_id`, { type: 'resourcePicker', label: `Tab ${n} product source`, resourceType: 'product' });
      defaultSettings[`tab_${n}_label`] = `Tab ${n}`;
      return {
        type: 'tab',
        props: { slot: n, label: `{{settings.tab_${n}_label}}` },
        children: [{ type: 'collection_grid' }],
      };
    });
    children.push({ type: 'tabs', children: tabs });
    defaultSettings.grid_show_atc = true;
  }

  if (baN) {
    for (let i = 1; i <= baN; i += 1) {
      field(schema, `before_${i}`, { type: 'image', label: `Before ${i}`, default: '' });
      field(schema, `after_${i}`, { type: 'image', label: `After ${i}`, default: '' });
      field(schema, `before_label_${i}`, { type: 'text', label: `Before ${i} label`, default: 'Before' });
      field(schema, `after_label_${i}`, { type: 'text', label: `After ${i} label`, default: 'After' });
      defaultSettings[`before_label_${i}`] = 'Before';
      defaultSettings[`after_label_${i}`] = 'After';
      children.push({
        type: 'stack',
        children: [
          pushHeading(`Compare ${i} heading`, `Compare ${i}`),
          pushText(`Compare ${i} text`, ''),
          {
            type: 'before_after',
            props: {
              slot: i,
              before: `{{settings.before_${i}}}`,
              after: `{{settings.after_${i}}}`,
              before_label: `{{settings.before_label_${i}}}`,
              after_label: `{{settings.after_label_${i}}}`,
            },
          },
          pushButton(`Compare ${i} button`, 'Shop Now'),
        ],
      });
    }
  }

  if (compare) {
    const count = Math.max(productN, 4);
    for (let i = 1; i <= count; i += 1) {
      field(schema, `product_${i}`, { type: 'resourcePicker', label: `Compare product ${i}`, resourceType: 'product' });
    }
    children.push({ type: 'comparison_table', children: [] });
    productN = 0;
  } else if (productN) {
    const nodes = Array.from({ length: productN }, (_, i) => ({ type: 'product', props: { slot: i + 1 } }));
    for (let i = 1; i <= productN; i += 1) {
      field(schema, `product_${i}`, { type: 'resourcePicker', label: productN === 1 ? 'Product' : `Product ${i}`, resourceType: 'product' });
    }
    children.push({ type: productCarousel ? 'carousel' : 'grid', children: nodes });
    defaultSettings.enable_quantity = true;
    defaultSettings.show_rating = true;
  }

  if (collectionGrid) {
    field(schema, 'collection_id', { type: 'resourcePicker', label: 'Collection', resourceType: 'collection' });
    children.push({ type: 'collection_grid' });
  } else if (collectionN) {
    const nodes = Array.from({ length: collectionN }, (_, i) => {
      const n = i + 1;
      field(schema, `collection_${n}`, { type: 'resourcePicker', label: `Card ${n} collection`, resourceType: 'collection' });
      field(schema, `collection_${n}_title`, { type: 'text', label: `Card ${n} title`, default: '' });
      field(schema, `collection_${n}_image`, { type: 'image', label: `Card ${n} image`, default: '' });
      field(schema, `collection_${n}_cta`, { type: 'text', label: `Card ${n} button`, default: 'Shop Now' });
      defaultSettings[`collection_${n}_cta`] = 'Shop Now';
      return { type: 'collection', props: { slot: n } };
    });
    children.push({ type: 'grid', children: nodes });
  }

  if (icons) {
    const count = detectN(t, 'features?|icons?') || 4;
    children.push({
      type: 'grid',
      children: Array.from({ length: count }, (_, i) => ({ type: 'icon', props: { slot: i + 1 } })),
    });
  }

  if (testi) {
    const count = detectN(t, 'testimonials?') || 3;
    children.push({
      type: 'testimonial',
      children: Array.from({ length: count }, (_, i) => ({ type: 'testimonial_item', props: { slot: i + 1 } })),
    });
  }

  if (/\bhero\b/.test(t) && !video) {
    children.unshift({
      type: 'row',
      children: [
        pushImage('Hero image'),
        {
          type: 'column',
          children: [pushHeading('Hero heading', 'Hero'), pushText('Hero text', ''), pushButton('Hero button', 'Shop Now')],
        },
      ],
    });
  }

  const cardN = detectN(t, 'cards?');
  if (cardN >= 4 && !bentoN && !storyN) {
    const cards = Array.from({ length: cardN }, (_, i) => ({
      type: 'stack',
      children: [pushImage(`Card ${i + 1} image`), pushHeading(`Card ${i + 1} heading`, `Card ${i + 1}`), pushText(`Card ${i + 1} text`, ''), pushButton(`Card ${i + 1} button`, 'Shop Now')],
    }));
    children.push({ type: 'grid', children: cards });
    defaultSettings.columns = defaultSettings.columns || '2';
  }

  if (/\b4-column\b|\b4 column\b|\bdesktop 4\b|\b4-col/.test(t)) {
    defaultSettings.columns = '4';
    schema.columns = { type: 'select', label: 'Columns', default: '4', options: [{ label: '2', value: '2' }, { label: '3', value: '3' }, { label: '4', value: '4' }] };
  }
  if (/\btablet 2\b|\b2-column\b|\b2 column\b/.test(t)) {
    defaultSettings.tablet_columns = '2';
    schema.tablet_columns = { type: 'select', label: 'Tablet columns', default: '2', options: [{ label: '1', value: '1' }, { label: '2', value: '2' }, { label: '3', value: '3' }] };
  }
  if (mobileCarousel) {
    defaultSettings.mobile_layout = 'carousel';
    schema.mobile_layout = { type: 'select', label: 'Mobile layout', default: 'carousel', options: [{ label: 'Stack', value: 'stack' }, { label: 'Carousel', value: 'carousel' }] };
  }

  if (faq && !sticky) {
    const count = detectN(t, 'questions?|faqs?') || 4;
    children.push({
      type: 'accordion',
      children: Array.from({ length: count }, (_, i) => ({ type: 'accordion_item', props: { slot: i + 1 } })),
    });
  }

  if (defaultSettings.columns === '4' || defaultSettings.mobile_layout === 'carousel') {
    const hasGrid = children.some((c) => c && (c.type === 'grid' || c.type === 'carousel' || c.type === 'bento' || c.type === 'collection_grid'));
    if (!hasGrid) {
      children.push({
        type: 'grid',
        children: Array.from({ length: 4 }, (_, i) => ({
          type: 'stack',
          children: [pushImage(`Item ${i + 1}`), pushHeading(`Item ${i + 1} heading`, `Item ${i + 1}`)],
        })),
      });
    }
  }

  if (!children.length) {
    children.push(pushHeading('Heading', 'Heading'), pushText('Description', ''), pushButton('Button', 'Shop Now'));
  }

  return {
    name: plan.purpose || 'Custom Section',
    schema,
    defaultSettings,
    layout: stampUsbIds({ type: 'container', id: 'section_root', children: [{ type: 'stack', children }] }),
  };
}

function stampUsbIds(node: any, counter = { n: 0 }): any {
  if (!node || typeof node !== 'object') return node;
  counter.n += 1;
  const next = { ...node, id: node.id || `${node.type}_${counter.n}` };
  if (Array.isArray(node.children)) next.children = node.children.map((child: any) => stampUsbIds(child, counter));
  return next;
}
