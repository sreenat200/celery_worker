import type { SectionStylePlan } from './ai-section-style-planner';

const DEFAULT_NAMES = ['Necklaces', 'Earrings', 'Rings', 'Bracelets'];

export function extractCollectionNames(prompt: string): string[] {
  const listed = prompt.match(
    /(?:necklaces?|earrings?|rings?|bracelets?|pendants?|anklets?|bangles?|chains?|brooches?)/gi,
  );
  const unique = Array.from(new Set((listed || []).map((n) => n[0].toUpperCase() + n.slice(1).toLowerCase())));
  if (unique.length >= 2) return unique.slice(0, 6);
  return DEFAULT_NAMES;
}

export function synthesizeCollectionBlocksBlueprint(prompt: string, style: SectionStylePlan) {
  const names = extractCollectionNames(prompt);
  const schema: Record<string, any> = {
    button_text: { type: 'text', label: 'Button label', default: 'Shop Now' },
  };
  const defaultSettings: Record<string, any> = {
    button_text: 'Shop Now',
    ...style.settings,
  };
  const rows = names.map((name, i) => {
    const n = i + 1;
    schema[`heading_${n}`] = { type: 'text', label: `${name} heading`, default: name };
    schema[`text_${n}`] = { type: 'richtext', label: `${name} description`, default: `Discover our ${name.toLowerCase()}.` };
    schema[`image_${n}`] = { type: 'image', label: `${name} image`, default: '' };
    schema[`button_link_${n}`] = { type: 'link', label: `${name} link`, default: '/collections' };
    defaultSettings[`heading_${n}`] = name;
    defaultSettings[`text_${n}`] = `Discover our ${name.toLowerCase()}.`;
    defaultSettings[`image_${n}`] = '';
    defaultSettings[`button_link_${n}`] = '/collections';
    return {
      type: 'row',
      children: [
        { type: 'image', props: { src: `{{settings.image_${n}}}`, alt: name } },
        {
          type: 'column',
          children: [
            { type: 'heading', props: { content: `{{settings.heading_${n}}}` } },
            { type: 'text', props: { content: `{{settings.text_${n}}}` } },
            {
              type: 'button',
              props: { label: '{{settings.button_text}}', link: `{{settings.button_link_${n}}}` },
            },
          ],
        },
      ],
    };
  });

  return {
    name: 'Collection Showcase',
    schema,
    defaultSettings,
    layout: { type: 'container', children: [{ type: 'stack', children: rows }] },
  };
}

const SAMPLE_QUOTES = [
  { name: 'Aisha K.', quote: 'Beautiful quality and arrived quickly. I wear it every day.', rating: 5 },
  { name: 'Priya M.', quote: 'Exceeded my expectations. Packaging felt so premium.', rating: 5 },
  { name: 'Rahul S.', quote: 'Thoughtful design and excellent customer care.', rating: 4 },
];

export function synthesizeTestimonialBlueprint(_prompt: string, style: SectionStylePlan) {
  const schema: Record<string, any> = {
    heading: { type: 'text', label: 'Heading', default: 'What our customers say' },
  };
  const defaultSettings: Record<string, any> = {
    heading: 'What our customers say',
    ...style.settings,
  };
  const items = SAMPLE_QUOTES.map((item, i) => {
    const n = i + 1;
    schema[`t_${n}_name`] = { type: 'text', label: `Customer ${n} name`, default: item.name };
    schema[`t_${n}_quote`] = { type: 'richtext', label: `Customer ${n} review`, default: item.quote };
    schema[`t_${n}_rating`] = { type: 'number', label: `Customer ${n} stars`, default: String(item.rating) };
    schema[`t_${n}_image`] = { type: 'image', label: `Customer ${n} photo`, default: '' };
    defaultSettings[`t_${n}_name`] = item.name;
    defaultSettings[`t_${n}_quote`] = item.quote;
    defaultSettings[`t_${n}_rating`] = String(item.rating);
    defaultSettings[`t_${n}_image`] = '';
    return {
      type: 'testimonial_item',
      props: {
        name: `{{settings.t_${n}_name}}`,
        quote: `{{settings.t_${n}_quote}}`,
        rating: `{{settings.t_${n}_rating}}`,
        image: `{{settings.t_${n}_image}}`,
      },
    };
  });
  return {
    name: 'Testimonials',
    schema,
    defaultSettings,
    layout: {
      type: 'container',
      children: [
        { type: 'heading', props: { content: '{{settings.heading}}' } },
        { type: 'testimonial', children: items },
      ],
    },
  };
}

const SAMPLE_FAQS = [
  { q: 'What is your return policy?', a: 'We offer 30-day hassle-free returns on unused items in original packaging.' },
  { q: 'How long does shipping take?', a: 'Standard delivery takes 3–7 business days. Express options are available at checkout.' },
  { q: 'Do you ship internationally?', a: 'Yes. International orders typically arrive within 7–14 business days.' },
  { q: 'How can I track my order?', a: 'You will receive a tracking link by email as soon as your order ships.' },
];

export function isFaqPrompt(prompt: string): boolean {
  return /\bfaqs?\b|\baccordion\b|\bq\s*&\s*a\b|\bquestions? and answers?\b/i.test(prompt || '');
}

export function synthesizeFaqBlueprint(_prompt: string, style: SectionStylePlan) {
  const schema: Record<string, any> = {
    heading: { type: 'text', label: 'Heading', default: 'Frequently asked questions' },
  };
  const defaultSettings: Record<string, any> = {
    heading: 'Frequently asked questions',
    bg_color: style.settings.bg_color || '#ffffff',
    heading_color: '#111827',
    text_color: '#111827',
    heading_font_family: 'Inter',
    body_font_family: 'Inter',
    border_radius: '16',
    ...style.settings,
  };
  const items = SAMPLE_FAQS.map((item, i) => {
    const n = i + 1;
    schema[`faq_${n}_q`] = { type: 'text', label: `Question ${n}`, default: item.q };
    schema[`faq_${n}_a`] = { type: 'richtext', label: `Answer ${n}`, default: item.a };
    defaultSettings[`faq_${n}_q`] = item.q;
    defaultSettings[`faq_${n}_a`] = item.a;
    return {
      type: 'accordion_item',
      props: { slot: n, question: `{{settings.faq_${n}_q}}`, answer: `{{settings.faq_${n}_a}}` },
    };
  });
  return {
    name: 'FAQ',
    schema,
    defaultSettings,
    layout: {
      type: 'container',
      children: [
        { type: 'heading', props: { content: '{{settings.heading}}' } },
        { type: 'accordion', children: items },
      ],
    },
  };
}

export function isLuxuryComboPrompt(prompt: string): boolean {
  const t = (prompt || '').toLowerCase();
  const luxury = /\bluxury\b|\bjewel/.test(t);
  const collections = /\bcollection/.test(t);
  const products = /\bproducts?\b/.test(t);
  const extras = /\bicon|\bbefore|\bcta|\bbutton|\brating|\bquantity/.test(t);
  return luxury && collections && products && extras;
}

export function synthesizeLuxuryComboBlueprint(prompt: string, style: SectionStylePlan) {
  const names = extractCollectionNames(prompt);
  const defaultSettings: Record<string, any> = {
    heading: 'The Collection',
    subheading: 'Crafted pieces for every occasion.',
    eyebrow: 'Fine Jewelry',
    button_text: 'Shop Now',
    button_1_text: 'Shop Now',
    button_2_text: 'View Collection',
    button_3_text: 'Learn More',
    button_1_bg: '#d4af37',
    button_1_color: '#111827',
    button_1_hover_bg: '#0a1628',
    button_1_hover_color: '#ffffff',
    button_2_variant: 'outline',
    button_2_bg: 'transparent',
    button_2_color: '#d4af37',
    button_2_border_color: '#d4af37',
    button_2_border_width: '1',
    button_2_hover_bg: '#d4af37',
    button_2_hover_color: '#111827',
    button_3_variant: 'ghost',
    enable_quantity: 'true',
    show_rating: 'true',
    before_label: 'Before',
    after_label: 'After',
    icon_1_name: 'truck',
    icon_1_heading: 'Free Shipping',
    icon_1_description: 'Complimentary delivery on every order.',
    icon_1_bg: '#d4af37',
    icon_2_name: 'shield',
    icon_2_heading: 'Secure Payment',
    icon_2_description: 'Protected checkout from start to finish.',
    icon_2_bg: '#0a1628',
    icon_3_name: 'refresh-cw',
    icon_3_heading: 'Easy Returns',
    icon_3_description: 'Hassle-free exchanges within 30 days.',
    icon_3_bg: '#6b1d2a',
    icon_4_name: 'package',
    icon_4_heading: 'Premium Packaging',
    icon_4_description: 'Gift-ready boxes with every piece.',
    icon_4_bg: '#f5f0e8',
    heading_font_family: 'Playfair Display',
    bg_color: '#0a1628',
    heading_color: '#f5f0e8',
    text_color: '#f5f0e8',
    button_bg: '#d4af37',
    button_text_color: '#111827',
    button_hover_bg: '#0a1628',
    button_hover_color: '#ffffff',
    price_color: '#d4af37',
    card_bg: '#f5f0e8',
    hover_scale: '1.02',
    columns: '4',
    tablet_columns: '2',
    mobile_layout: 'stack',
    ...style.settings,
  };

  names.forEach((name, i) => {
    const n = i + 1;
    defaultSettings[`collection_${n}_title`] = name;
    defaultSettings[`collection_${n}_description`] = `Explore our ${name.toLowerCase()}.`;
    defaultSettings[`collection_${n}_cta`] = 'Shop Now';
    defaultSettings[`collection_${n}_cta_bg`] = '#d4af37';
    defaultSettings[`collection_${n}_cta_color`] = '#111827';
    defaultSettings[`collection_${n}_cta_radius`] = '8';
    defaultSettings[`collection_${n}_shadow`] = 'soft';
    defaultSettings[`collection_${n}_radius`] = '16';
  });

  const collectionCards = names.slice(0, 4).map((_, i) => ({
    type: 'collection',
    props: { slot: i + 1 },
  }));
  const products = [1, 2, 3, 4].map((n) => ({ type: 'product', props: { slot: n } }));
  const icons = [1, 2, 3, 4].map((n) => ({ type: 'icon', props: { slot: n } }));

  return {
    name: 'Luxury Jewelry',
    schema: {
      heading: { type: 'text', label: 'Heading', default: 'The Collection' },
      subheading: { type: 'richtext', label: 'Description', default: '' },
      before: { type: 'image', label: 'Before image', default: '' },
      after: { type: 'image', label: 'After image', default: '' },
    },
    defaultSettings,
    layout: {
      type: 'container',
      children: [
        { type: 'heading', props: { content: '{{settings.heading}}' } },
        { type: 'text', props: { content: '{{settings.subheading}}' } },
        { type: 'grid', children: collectionCards },
        { type: 'grid', children: products },
        { type: 'grid', children: icons },
        { type: 'before_after', props: { before: '{{settings.before}}', after: '{{settings.after}}' } },
        {
          type: 'stack',
          children: [
            { type: 'button', props: { slot: 1, label: '{{settings.button_1_text}}', link: '/collections' } },
            { type: 'button', props: { slot: 2, label: '{{settings.button_2_text}}', link: '/collections' } },
            { type: 'button', props: { slot: 3, label: '{{settings.button_3_text}}', link: '/about' } },
          ],
        },
      ],
    },
  };
}
