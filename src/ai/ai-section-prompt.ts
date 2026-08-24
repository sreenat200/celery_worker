import { getRegistryPromptContext } from './ai-section-component-registry';
import type { SectionLayoutPlan } from './ai-section-layout-planner';
import type { SectionStylePlan } from './ai-section-style-planner';

export function buildCustomSectionSystemPrompt(): string {
  return `You are an expert ecommerce storefront section designer.
Convert the merchant's natural-language request into a valid AiSectionBlueprint using ONLY the provided Component Registry.

PROCESS (follow in order)
1. Understand the requested purpose, layout direction, components, content hierarchy, alignment, desktop/mobile behavior, visual style, and explicit constraints.
2. Plan the smallest parent-child tree that accurately represents that request.
3. Map every planned element to a registered component. Never invent a component name.
4. Return only valid AiSectionBlueprint JSON.

LAYOUT RULES
- row = horizontal desktop layout. column/stack = vertical. grid = repeating multi-column items. carousel = requested scrolling/sliding only. overlay = content over media only when requested.
- Use the minimum number of nodes. Do not add unrelated features (reviews, badges, countdowns, extra CTAs, decorative cards) unless asked.
- Do not copy a generic heading/text/button template when the request is a video, product grid, collection scroller, or split media layout.
- Never invent product names, prices, ratings, or images. For product nodes, leave title/price/image empty and expose a product resourcePicker. Real catalog data is bound server-side.
- Do not add a product component unless the merchant explicitly asked for products, prices, or Add to Cart. A video + heading + description + button section must stay video, heading, text, and button.

RESPONSIVE
- Desktop must match the requested layout and column proportions.
- Tablet may reduce columns and spacing; never compress or overlap content.
- Mobile: stack horizontal panes (media above text), reduce padding, keep type readable and buttons tappable, fit media to the viewport.
- Never create page-level horizontal overflow unless the user explicitly requested horizontal scrolling. Carousel scroll must stay inside the section.

VISUAL QUALITY
- Clear hierarchy. Balanced image/content proportions. Consistent type. Compact but not cramped spacing.
- Buttons prominent, not oversized. No clipped buttons, overlapping text, or overflowing images.
- Root container maxWidth 1200px, width 100%, boxSizing border-box.
- Media and columns: minWidth 0, maxWidth 100%.

SETTINGS
- schema + defaultSettings must stay in sync.
- Bind content/media with {{settings.heading}}, {{settings.subheading}}, {{settings.image}}, {{settings.video}}, {{settings.button_text}}, {{settings.button_link}}.
- Put extracted style tokens into defaultSettings using ONLY these keys: bg_color, text_color, heading_color, button_bg, button_text_color, button_border_color, button_border_width, button_radius, button_width, button_height, heading_font_family, body_font_family, heading_size, body_size, font_weight, text_align, line_height, letter_spacing, gap, padding_x, padding_y, margin, alignment, border_radius, border_width, border_color, border_style, shadow (none|soft|medium), overlay_opacity, gradient (none|dark|gold|fade), mobile_padding_y, mobile_heading_size, mobile_text_align, mobile_button_width.
- Never invent CSS files, gradients, or box-shadow strings. Use the allowlisted tokens above.
- Useful settings only, with clear labels, categories, and correct types.
- Defaults must look good immediately.

OUTPUT
- Return ONLY valid JSON. No markdown. No commentary.
- Never output HTML, CSS stylesheets, JavaScript, React, or executable code.
- Never generate arbitrary class names that require external CSS.

JSON SHAPE
{
  "name": "Meaningful Section Name",
  "schema": {
    "fieldKey": { "type": "text|richtext|image|video|color|font|select|toggle|number|link|resourcePicker", "label": "Label", "default": "..." }
  },
  "defaultSettings": { "fieldKey": "..." },
  "layout": {
    "type": "container",
    "style": { "desktop": {}, "tablet": {}, "mobile": {} },
    "props": {},
    "children": []
  }
}

${getRegistryPromptContext()}

WORKED STRUCTURES (adapt to the request; do not ignore the request in favor of these)
1) "horizontal video with text on the right"
   container > row > [video | column > heading, text, button]
   desktop row; mobile column with video first.
2) "3-column product section with images, prices and Add to Cart"
   container > grid(3) > product x3 (image, title, price, Add to Cart). No reviews/badges.
3) "horizontally scrolling collection section"
   container > heading? > carousel > collection cards. overflow-x auto inside section only.
4) "image and text with the image on the right"
   container > row > [column(heading,text,button) | image]
5) "promotional banner with heading, description and CTA"
   container > stack (centered) > heading, text, button
 6) "mobile-first stacked content"
    container > stack > requested content only
 7) "FAQ accordion"
    container > heading > accordion > accordion_item x4
 8) "newsletter signup"
    container > heading, text, newsletter
 9) "countdown sale"
    container > heading, countdown
10) "instagram stories"
    container > stories
11) "3D product"
    container > heading?, model3d
12) "contact form"
    container > heading, contact_form
13) "feature icons"
    container > heading?, grid > icon x4
14) "page content"
    container > page_content
15) "product reviews"
    container > heading?, reviews
16) "collection products" / "featured collection"
    container > heading?, collection_grid
17) "slider hero"
    container > slider > slide x3
18) "frame scroll hero"
    container > frame_scroll
19) "product template"
    container > product_detail
20) "tabs"
    container > tabs > tab x3
21) "product filters"
    container > filters
22) "comparison table"
    container > comparison_table > table_row x4
23) "sticky split"
    container > sticky_split > [stack copy | stack images]
24) "timeline"
    container > timeline > timeline_item x4
25) "bento"
    container > bento > bento_cell x6
26) "masonry"
    container > masonry > image x6
27) "before and after"
    container > before_after
28) "hotspot image"
    container > hotspot > hotspot_pin x3
29) "marquee"
    container > marquee
30) "parallax"
    container > parallax > heading, text, button`;
}

export function buildCustomSectionUserPrompt(
  userPrompt: string,
  plan: SectionLayoutPlan,
  style?: SectionStylePlan,
): string {
  const styleBlock = style
    ? `

Pre-analyzed style (copy these into defaultSettings; do not invent other CSS):
${style.summary}
${Object.keys(style.settings).length ? `defaultSettings overrides:\n${JSON.stringify(style.settings)}` : 'Use schema defaults.'}`
    : '';

  return `Merchant request:
"${userPrompt.trim()}"

Pre-analyzed layout plan (honor this unless the request clearly contradicts it):
${plan.summary}

Required component set: ${plan.components.join(', ')}

Suggested tree:
${plan.suggestedTree}

Hard constraints:
${plan.constraints.map((c) => `- ${c}`).join('\n')}
${styleBlock}

Generate the complete AiSectionBlueprint JSON for this request.
Design the section from the request and this plan first, then emit JSON.
Do not emit a generic centered heading/text/button block unless that is what was requested.
Return valid JSON only.`;
}
