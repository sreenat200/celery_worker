import type { SectionLayoutPlan } from './ai-section-layout-planner';
import type { SectionStylePlan } from './ai-section-style-planner';

export function buildCustomSectionSystemPrompt(): string {
  return `You are an expert ecommerce storefront section designer.
Convert the merchant's request into ONE compact AiSectionBlueprint JSON object.

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

STYLE GUIDELINES (CRITICAL - FOLLOW STRICTLY):

Typography:
- Heading font-weight: 500-600 (NEVER 700+)
- Body font-size: 15-16px
- Heading line-height: 1.2-1.3
- Body line-height: 1.5-1.6
- Large headings (24px+): letter-spacing: -0.02em
- Eyebrow/caption: uppercase, letter-spacing: 0.08em, 12px

Spacing:
- Section padding: 64-80px desktop, 40px mobile
- Card padding: 24px
- Grid gap: 24-32px desktop, 16px mobile
- Use 8px spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96

Cards:
- border-radius: 8px
- box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1)
- hover: translateY(-2px), stronger shadow
- image aspect-ratio: 1:1 products, 4:3 features, 16:9 banners

Buttons:
- min-height: 44px
- padding: 12px 28px
- border-radius: 8px
- font-weight: 600
- Primary: solid dark background, white text
- Secondary: transparent with 1px border
- hover: opacity 0.85, translateY(-1px)

Responsive:
- Mobile: 1 column, 40px padding, font-size 60% of desktop
- Tablet: 2 columns
- Desktop: as specified

EXAMPLE 1 - Premium Hero:
{"type":"container","style":{"desktop":{"maxWidth":"1200px","margin":"0 auto","padding":"80px 24px"}},"children":[{"type":"heading","props":{"content":"Craftsmanship Redefined","variant":"h1"},"style":{"desktop":{"fontSize":"56px","fontWeight":"600","letterSpacing":"-0.02em","lineHeight":"1.2","color":"#0F172A"},"mobile":{"fontSize":"32px"}}}]}

EXAMPLE 2 - Premium Product Card:
{"type":"container","style":{"desktop":{"borderRadius":"8px","boxShadow":"0 4px 6px -1px rgba(0,0,0,0.1)","padding":"24px","backgroundColor":"#FFFFFF"},"hover":{"transform":"translateY(-2px)","boxShadow":"0 8px 12px -2px rgba(0,0,0,0.12)"}}}

EXAMPLE 3 - Premium Button:
{"type":"button","props":{"label":"Shop Now","link":"#shop"},"style":{"desktop":{"backgroundColor":"#0F172A","color":"#FFFFFF","padding":"12px 28px","borderRadius":"8px","fontWeight":"600","minHeight":"44px"},"hover":{"opacity":"0.85","transform":"translateY(-1px)"}}}

SETTINGS
- Emit a SMALL schema: only content fields (heading, text, image, button_text, button_link, faq_1_q, faq_1_a). Do NOT emit select options, chrome, array, list, or style field definitions.
- Never use setting type "array". FAQ must be accordion + accordion_item with faq_N_q / faq_N_a text fields.
- Bind with {{settings.heading}}, {{settings.subheading}}, {{settings.image}}, {{settings.button_text}}, {{settings.button_link}}.
- Leave product/collection IDs empty. Never invent IDs.
- Do not emit multiple JSON objects. One object only.
- Keep JSON compact. Omit empty style objects. Max 24 layout nodes. Do not repeat the same setting in schema and defaultSettings.

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

Allowed types only: container,row,column,grid,stack,carousel,heading,text,image,video,button,product,collection,accordion,accordion_item,newsletter,countdown,stories,model3d,contact_form,icon,page_content,reviews,collection_grid,slider,slide,frame_scroll,product_detail,tabs,tab,filters,comparison_table,table_row,sticky_split,timeline,timeline_item,bento,bento_cell,masonry,before_after,hotspot,hotspot_pin,marquee,parallax,recommend,specs,nav,size_guide,whatsapp,shipping,testimonial,testimonial_item.

Keep the tree small. Omit empty style objects.`;
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
