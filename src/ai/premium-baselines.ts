import { DESIGN_TOKENS } from './design-tokens';

/**
 * Composable premium baselines — starting skeletons built entirely from
 * registered primitives, each carrying Shopify-quality default styles.
 * The AI may use these as structural starting points and fill them with
 * merchant-specific content.
 */

export interface PremiumBaseline {
  name: string;
  summary: string;
  layout: any;
}

const { colors, shadows, border_radius, spacing, transitions } = DESIGN_TOKENS;

const heading = (content: string, size = '32px', variant = 'h2'): any => ({
  type: 'heading',
  props: { content, variant },
  style: {
    desktop: { fontSize: size, fontWeight: '600', letterSpacing: '-0.02em', lineHeight: '1.2', color: colors.text_primary },
    mobile: { fontSize: '24px' },
  },
});

const text = (content: string): any => ({
  type: 'text',
  props: { content },
  style: { desktop: { fontSize: '16px', lineHeight: '1.6', color: colors.text_secondary } },
});

const button = (label: string, link = '/collections', secondary = false): any => ({
  type: 'button',
  props: { label, link },
  style: {
    desktop: secondary
      ? { backgroundColor: 'transparent', color: colors.primary, border: `1px solid ${colors.primary}`, padding: '12px 28px', borderRadius: border_radius.md, fontWeight: '600', minHeight: '44px' }
      : { backgroundColor: colors.primary, color: colors.text_inverse, padding: '12px 28px', borderRadius: border_radius.md, fontWeight: '600', minHeight: '44px' },
    hover: { opacity: '0.85', transform: 'translateY(-1px)' },
  },
});

const card = (children: any[]): any => ({
  type: 'container',
  style: {
    desktop: { borderRadius: border_radius.md, boxShadow: shadows.md, padding: spacing.default_card_padding, backgroundColor: colors.surface },
    hover: { transform: 'translateY(-2px)', boxShadow: shadows.hover, transition: transitions.normal },
  },
  children,
});

const section = (children: any[], gap = '24px'): any => ({
  type: 'container',
  style: { desktop: { maxWidth: '1200px', margin: '0 auto', padding: '64px 24px', gap }, mobile: { padding: '40px 16px' } },
  children,
});

const imageNode = (alt = ''): any => ({
  type: 'image',
  props: { alt },
  style: { desktop: { width: '100%', maxWidth: '100%', height: 'auto', objectFit: 'cover', borderRadius: border_radius.md, aspectRatio: '1/1' } },
});

export const PREMIUM_BASELINES: Record<string, PremiumBaseline> = {
  hero_banner: {
    name: 'Hero Banner',
    summary: 'container > heading + text + row(button + secondary button)',
    layout: section([
      heading('Craftsmanship Redefined', '48px', 'h1'),
      text('Discover our signature collection, made to last.'),
      { type: 'row', children: [button('Shop Now'), button('Learn More', '/about', true)] },
    ]),
  },

  product_grid: {
    name: 'Product Grid',
    summary: 'container > heading + grid(4 x product cards)',
    layout: section([
      heading('Featured Products'),
      {
        type: 'grid',
        style: { desktop: { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '24px' }, tablet: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }, mobile: { gridTemplateColumns: 'minmax(0, 1fr)' } },
        children: [1, 2, 3, 4].map(() => ({ type: 'product', style: { desktop: { borderRadius: border_radius.md, boxShadow: shadows.md, padding: '16px' } } })),
      },
    ]),
  },

  feature_cards: {
    name: 'Feature Cards',
    summary: 'container > heading + grid(3 x icon + heading + text cards)',
    layout: section([
      heading('Why Choose Us'),
      {
        type: 'grid',
        style: { desktop: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '24px' }, mobile: { gridTemplateColumns: 'minmax(0, 1fr)' } },
        children: [1, 2, 3].map((n) => card([{ type: 'icon', props: { slot: n } }, heading(`Feature ${n}`, '20px', 'h3'), text('A concise value proposition.')])),
      },
    ]),
  },

  testimonial_slider: {
    name: 'Testimonial Slider',
    summary: 'container > heading + carousel(3 x testimonial_item)',
    layout: section([
      heading('Loved by Customers'),
      {
        type: 'carousel',
        style: { desktop: { display: 'flex', gap: '16px', overflowX: 'auto' } },
        children: [1, 2, 3].map((n) => ({ type: 'testimonial_item', props: { slot: n, rating: 5 }, style: { desktop: { borderRadius: border_radius.md, boxShadow: shadows.md, padding: '24px', backgroundColor: colors.background } } })),
      },
    ]),
  },

  newsletter_signup: {
    name: 'Newsletter Signup',
    summary: 'container > heading + text + newsletter',
    layout: section([
      heading('Join the Inner Circle'),
      text('Get 15% off your first order.'),
      { type: 'newsletter', props: { button_text: 'Subscribe' } },
    ]),
  },

  image_with_text: {
    name: 'Image with Text',
    summary: 'container > row(image + column(heading + text + button))',
    layout: section([
      {
        type: 'row',
        style: { desktop: { display: 'flex', gap: '32px', alignItems: 'center' }, mobile: { flexDirection: 'column' } },
        children: [
          imageNode('Story image'),
          { type: 'column', children: [heading('Our Story', '32px'), text('Crafted with purpose.'), button('Read More', '/about')] },
        ],
      },
    ]),
  },

  video_showcase: {
    name: 'Video Showcase',
    summary: 'container > video + heading + text',
    layout: section([
      { type: 'video', props: { autoplay: true, muted: true }, style: { desktop: { width: '100%', borderRadius: border_radius.md, aspectRatio: '16/9' } } },
      heading('Watch the Film', '32px'),
      text('A closer look at the collection.'),
    ]),
  },

  faq_accordion: {
    name: 'FAQ Accordion',
    summary: 'container > heading + accordion(4 x accordion_item)',
    layout: section([
      heading('Frequently Asked Questions'),
      { type: 'accordion', children: [1, 2, 3, 4].map((n) => ({ type: 'accordion_item', props: { slot: n } })) },
    ]),
  },

  countdown_promo: {
    name: 'Countdown Promo',
    summary: 'container > heading + text + countdown + button',
    layout: section([
      heading('Flash Sale Ends Soon'),
      text('Don\u2019t miss out on limited-time savings.'),
      { type: 'countdown', props: { end_date: '' } },
      button('Shop the Sale'),
    ]),
  },
};

export function getBaselinesPromptContext(): string {
  return Object.entries(PREMIUM_BASELINES)
    .map(([key, b]) => `- ${key}: ${b.summary}`)
    .join('\n');
}
