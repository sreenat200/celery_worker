export const AI_FONT_OPTIONS = [
  { label: 'System Sans', value: 'system-ui' },
  { label: 'Inter', value: 'Inter' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Helvetica', value: 'Helvetica' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Playfair Display', value: 'Playfair Display' },
  { label: 'Cormorant Garamond', value: 'Cormorant Garamond' },
  { label: 'Cinzel', value: 'Cinzel' },
  { label: 'Montserrat', value: 'Montserrat' },
  { label: 'Poppins', value: 'Poppins' },
  { label: 'DM Sans', value: 'DM Sans' },
  { label: 'Lora', value: 'Lora' },
] as const;

export const AI_FONT_VALUES = new Set(AI_FONT_OPTIONS.map((o) => o.value));

export const AI_SHADOW_TOKENS: Record<string, string> = {
  none: 'none',
  soft: '0 8px 24px rgba(0,0,0,0.08)',
  subtle: '0 8px 24px rgba(0,0,0,0.08)',
  medium: '0 16px 40px rgba(0,0,0,0.16)',
};

export const AI_GRADIENT_TOKENS: Record<string, string> = {
  none: '',
  dark: 'linear-gradient(180deg, #000000 0%, #1a1a1a 100%)',
  gold: 'linear-gradient(135deg, #111111 0%, #3d2e0a 100%)',
  fade: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.05) 100%)',
};

const COLOR_NAMES: Array<[RegExp, string]> = [
  [/\bnavy\b|\bdark navy\b/, '#0a1628'],
  [/\bgold\b|\bchampagne\b/, '#d4af37'],
  [/\bbeige\b|\bcream\b|\bivory\b/, '#f5f0e8'],
  [/\bburgundy\b|\bmaroon\b|\bwine\b/, '#6b1d2a'],
  [/\bbrown\b|\bchocolate\b|\bespresso\b/, '#4a2c1a'],
  [/\bforest green\b|\bdark green\b/, '#14532d'],
  [/\bsage\b|\bmint\b/, '#86efac'],
  [/\bemerald\b/, '#059669'],
  [/\bteal\b/, '#0d9488'],
  [/\bolive\b/, '#4d7c0f'],
  [/\bgreen\b/, '#16a34a'],
  [/\bred\b|\bcrimson\b/, '#dc2626'],
  [/\bpink\b|\brose\b/, '#f472b6'],
  [/\bblue\b|\bsky\b/, '#2563eb'],
  [/\bpurple\b|\blavender\b|\bviolet\b/, '#7c3aed'],
  [/\borange\b/, '#ea580c'],
  [/\byellow\b/, '#eab308'],
  [/\bblack\b/, '#000000'],
  [/\bwhite\b/, '#ffffff'],
  [/\bcharcoal\b|\bnear[- ]black\b/, '#111827'],
  [/\bgray\b|\bgrey\b|\bslate\b/, '#6b7280'],
];

export interface SectionStylePlan {
  settings: Record<string, string>;
  notes: string[];
  summary: string;
}

function colorAfter(text: string, lead: RegExp, fallbackLead?: RegExp): string | undefined {
  const m = text.match(lead);
  const chunk = m?.[0] || (fallbackLead ? text.match(fallbackLead)?.[0] : '');
  if (!chunk) return undefined;
  for (const [re, hex] of COLOR_NAMES) {
    if (re.test(chunk)) return hex;
  }
  return undefined;
}

function firstColor(text: string): string | undefined {
  for (const [re, hex] of COLOR_NAMES) {
    if (re.test(text)) return hex;
  }
  return undefined;
}

function detectFont(text: string): string | undefined {
  if (/\bplayfair\b/.test(text)) return 'Playfair Display';
  if (/\bcormorant\b/.test(text)) return 'Cormorant Garamond';
  if (/\bcinzel\b/.test(text)) return 'Cinzel';
  if (/\blora\b/.test(text)) return 'Lora';
  if (/\bmontserrat\b/.test(text)) return 'Montserrat';
  if (/\bpoppins\b/.test(text)) return 'Poppins';
  if (/\binter\b/.test(text)) return 'Inter';
  if (/\barial\b/.test(text)) return 'Arial';
  if (/\bhelvetica\b/.test(text)) return 'Helvetica';
  if (/\bgeorgia\b/.test(text)) return 'Georgia';
  if (/\btimes\b/.test(text)) return 'Times New Roman';
  if (/\bserif\b|\belegan(t)?\b|\bluxury\b/.test(text)) return 'Playfair Display';
  if (/\bsans\b|\bmodern\b/.test(text)) return 'Inter';
  return undefined;
}

export function planSectionStyle(userPrompt: string): SectionStylePlan {
  const text = (userPrompt || '').toLowerCase();
  const settings: Record<string, string> = {};
  const notes: string[] = [];

  const bg =
    colorAfter(text, /(?:\w+\s+){0,3}(?:background|bg)(?:\s+\w+){0,4}/) ||
    ((/\bbackground\b|\bbg\b/.test(text) && firstColor(text)) || undefined);
  if (bg) {
    settings.bg_color = bg;
    notes.push(`bg_color=${bg}`);
  } else if (/\bluxury\b/.test(text) && /\bblack\b/.test(text)) {
    settings.bg_color = '#000000';
    notes.push('bg_color=#000000');
  }

  const headingColor = colorAfter(text, /(?:heading|title|headline)(?:\s+\w+){0,5}/);
  if (headingColor) {
    settings.heading_color = headingColor;
    notes.push(`heading_color=${headingColor}`);
  }

  const bodyColor = colorAfter(text, /(?:body|copy|description|subheading|gold text|text)(?:\s+\w+){0,5}/);
  if (bodyColor) {
    settings.text_color = bodyColor;
    notes.push(`text_color=${bodyColor}`);
  } else if (/\bgold typography\b|\bgold (?:text|type|fonts?)\b/.test(text)) {
    settings.text_color = '#d4af37';
    settings.heading_color = settings.heading_color || '#d4af37';
    notes.push('text_color=#d4af37');
  } else if (/\bdark text\b/.test(text)) {
    settings.text_color = '#111827';
    notes.push('text_color=#111827');
  }

  const btnColor = colorAfter(text, /(?:button|cta|shop now button)(?:\s+\w+){0,6}/);
  if (btnColor) {
    settings.button_bg = btnColor;
    notes.push(`button_bg=${btnColor}`);
    if (btnColor === '#d4af37' || btnColor === '#ffffff') settings.button_text_color = '#111827';
    if (btnColor === '#000000' || btnColor === '#0a1628' || btnColor === '#111827') settings.button_text_color = '#ffffff';
  }
  if (/\bgold prices?\b/.test(text)) {
    settings.price_color = '#d4af37';
    notes.push('price_color=#d4af37');
  }
  if (/\buppercase eyebrow\b/.test(text) || (/\beyebrow\b/.test(text) && /\buppercase\b/.test(text))) {
    settings.eyebrow_transform = 'uppercase';
    notes.push('eyebrow_transform=uppercase');
  } else if (/\buppercase\b/.test(text)) {
    settings.text_transform = 'uppercase';
    notes.push('text_transform=uppercase');
  }
  if (/\bhover\b/.test(text) && /\bbutton\b/.test(text)) {
    settings.button_hover_bg = settings.button_bg === '#d4af37' ? '#b8962e' : '#0f172a';
    notes.push('button_hover_bg');
  }
  if (/\bblue buttons?\b/.test(text)) {
    settings.button_bg = '#2563eb';
    settings.button_text_color = '#ffffff';
    notes.push('button_bg=#2563eb');
  }
  if (/\bcream cards?\b/.test(text)) {
    settings.card_bg = '#f5f0e8';
    notes.push('card_bg=#f5f0e8');
  }
  if (/\bwhite text\b/.test(text)) {
    settings.text_color = '#ffffff';
    notes.push('text_color=#ffffff');
  }

  const headingFontChunk = text.match(/(?:heading|title|headline)(?:\s+\w+){0,6}/);
  const bodyFontChunk = text.match(/(?:body|description|copy)(?:\s+\w+){0,6}/);
  const headingFont = headingFontChunk ? detectFont(headingFontChunk[0]) : undefined;
  const bodyFont = bodyFontChunk ? detectFont(bodyFontChunk[0]) : undefined;
  const font = detectFont(text);
  if (headingFont || font) {
    settings.heading_font_family = headingFont || font || 'Inter';
    notes.push(`heading_font_family=${settings.heading_font_family}`);
  }
  if (bodyFont) {
    settings.body_font_family = bodyFont;
    notes.push(`body_font_family=${bodyFont}`);
  } else if (font && /\bserif\b|\bluxury\b|\belegan/.test(text)) {
    settings.body_font_family = font === 'Playfair Display' ? 'Inter' : font;
  }

  if (/\blarge heading\b|\bxl heading\b|\bhero heading\b/.test(text)) {
    settings.heading_size = '56';
    notes.push('heading_size=56');
  } else if (/\bsmaller typography\b|\bsmall (?:type|font|heading)\b/.test(text)) {
    settings.heading_size = '28';
    settings.body_size = '14';
    notes.push('smaller typography');
  }

  if (/\bbold\b/.test(text)) settings.font_weight = '700';
  if (/\bmedium weight\b/.test(text)) settings.font_weight = '500';

  if (/\bcenter(?:ed)?\b/.test(text)) {
    settings.text_align = 'center';
    settings.alignment = 'center';
    notes.push('text_align=center');
  } else if (/\bright[- ]align/.test(text)) {
    settings.text_align = 'right';
  } else if (/\bleft[- ]align/.test(text)) {
    settings.text_align = 'left';
  }

  const radiusMatch = text.match(/\b(\d{1,3})\s*(?:px)?\s*(?:radius|rounded)\b/) || text.match(/\b(?:radius|rounded)\s*(?:of\s*)?(\d{1,3})\b/);
  if (radiusMatch) {
    settings.button_radius = String(Math.min(999, parseInt(radiusMatch[1], 10)));
    notes.push(`button_radius=${settings.button_radius}`);
  } else if (/\bpill\b/.test(text)) {
    settings.button_radius = '999';
    notes.push('button_radius=999');
  } else if (/\brounded (?:product )?cards?\b|\brounded\b/.test(text)) {
    settings.border_radius = '16';
    settings.button_radius = settings.button_radius || '12';
    notes.push('border_radius=16');
  }

  if (/\bcarousel on mobile\b|\bhorizontal scroll on mobile\b/.test(text)) {
    settings.mobile_layout = 'carousel';
    notes.push('mobile_layout=carousel');
  }

  if (/\bfull[- ]width buttons?\b/.test(text)) {
    settings.button_width = 'full';
    settings.mobile_button_width = 'full';
    notes.push('button_width=full');
  }
  if (/\bfull[- ]width (?:first |primary )?button\b/.test(text) || /\bbutton 1\b.*\bfull[- ]width\b/.test(text)) {
    settings.button_1_width = 'full';
    notes.push('button_1_width=full');
  }
  if (/\bbutton 2\b.*\bfull[- ]width\b/.test(text)) {
    settings.button_2_width = 'full';
    notes.push('button_2_width=full');
  }
  const btnHover = colorAfter(text, /(?:button|cta)(?:\s+\w+){0,4}\s+hover(?:\s+\w+){0,4}/);
  if (btnHover) {
    settings.button_1_hover_bg = btnHover;
    notes.push(`button_1_hover_bg=${btnHover}`);
  }
  if (/\bborder(?:ed)? buttons?\b/.test(text) || /\bbuttons?.{0,40}border\b/.test(text)) {
    settings.button_1_border_width = '1';
    settings.button_2_border_width = '1';
    notes.push('per-button border');
  }
  if (/\bquantity\b/.test(text) && /\b(product|selector|cart|recommend)\b/.test(text)) {
    settings.enable_quantity = 'true';
    settings.recommend_show_qty = 'true';
    settings.grid_show_qty = 'true';
    notes.push('enable_quantity');
  }
  if (/\brecommend/.test(text) && /\bgrid\b/.test(text)) {
    settings.recommend_layout = 'grid';
    notes.push('recommend_layout=grid');
  }
  if (/\brecommend/.test(text) && /\bcarousel\b/.test(text)) {
    settings.recommend_layout = 'carousel';
    notes.push('recommend_layout=carousel');
  }
  if (/\bcream\b/.test(text) && /\brecommend/.test(text)) {
    settings.recommend_card_bg = '#f5f0e8';
    notes.push('recommend_card_bg');
  }
  if (/\bnavy\b/.test(text) && /\brecommend/.test(text)) {
    settings.recommend_card_text = '#0a1628';
    notes.push('recommend_card_text');
  }
  if (/\brating\b/.test(text) && /\b(collection grid|collection-grid|tabs?)\b/.test(text)) {
    settings.grid_show_rating = 'true';
    notes.push('grid_show_rating');
  }
  if (/\badd to cart\b/.test(text) && /\b(collection grid|collection-grid|tabs?)\b/.test(text)) {
    settings.grid_show_atc = 'true';
    notes.push('grid_show_atc');
  }
  const pxWidth = text.match(/\b(\d{2,3})\s*px\s*(?:wide|width)?\s*(?:button|cta)?|\bbutton[s]?\s*(?:width|wide)\s*(\d{2,3})\b/);
  if (pxWidth) {
    const n = pxWidth[1] || pxWidth[2];
    settings.button_1_width = n;
    notes.push(`button_1_width=${n}`);
  }
  const pxRadius = text.match(/\bbutton[s]?\s*(?:radius|rounded)\s*(\d{1,3})|\b(\d{1,3})\s*px\s*(?:button\s*)?radius\b/);
  if (pxRadius) {
    settings.button_1_radius = pxRadius[1] || pxRadius[2];
    notes.push(`button_1_radius=${settings.button_1_radius}`);
  }
  if (/\brating\b/.test(text) && /\brecommend/.test(text)) {
    settings.recommend_show_rating = 'true';
    notes.push('recommend_show_rating');
  }
  if (/\badd to cart\b/.test(text) && /\brecommend/.test(text)) {
    settings.recommend_show_atc = 'true';
    notes.push('recommend_show_atc');
  }
  if (/\bbefore\s*(and|&|\/)\s*after\b/.test(text) || (/\bbefore\b/.test(text) && /\bafter\b/.test(text) && /\b(slider|compare|label)\b/.test(text))) {
    const beforeLab = text.match(/before(?:\s+label)?\s+[“"']?([a-z0-9 ]{1,20})/i);
    const afterLab = text.match(/after(?:\s+label)?\s+[“"']?([a-z0-9 ]{1,20})/i);
    if (beforeLab) settings.before_label = beforeLab[1].trim();
    else settings.before_label = 'Before';
    if (afterLab) settings.after_label = afterLab[1].trim();
    else settings.after_label = 'After';
    notes.push('before/after labels');
  }
  const iconBg = colorAfter(text, /(?:icon|feature card|value card)(?:\s+\w+){0,5}(?:background|bg)/);
  if (iconBg) {
    settings.icon_1_bg = iconBg;
    settings.icon_2_bg = iconBg;
    settings.icon_3_bg = iconBg;
    settings.icon_4_bg = iconBg;
    notes.push(`icon_N_bg=${iconBg}`);
  }
  if (/\bshop now\b/.test(text) && /\bcollection/.test(text)) {
    settings.collection_1_cta = 'Shop Now';
    settings.collection_2_cta = 'Shop Now';
    settings.collection_3_cta = 'Shop Now';
    settings.collection_4_cta = 'Shop Now';
    notes.push('collection CTAs');
  }

  if (/\bgenerous\b|\bspacious\b|\bair(?:y)?\b/.test(text)) {
    settings.padding_y = '80';
    settings.gap = '40';
    notes.push('generous spacing');
  } else if (/\bcompact\b|\btight\b|\breduced padding\b/.test(text)) {
    settings.padding_y = '24';
    settings.gap = '16';
    notes.push('compact spacing');
  }

  if (/\bsubtle shadow/.test(text) || /\bsoft shadow/.test(text)) {
    settings.shadow = 'soft';
    notes.push('shadow=soft');
  } else if (/\bshadow/.test(text) && !/\bno shadow/.test(text)) {
    settings.shadow = 'medium';
    notes.push('shadow=medium');
  }

  if (/\boverlay\b/.test(text)) {
    settings.overlay_opacity = '40';
    notes.push('overlay_opacity=40');
  }

  if (/\bgradient\b/.test(text)) {
    settings.gradient = /\bgold\b/.test(text) ? 'gold' : /\bblack\b|\bdark\b|\bluxury\b/.test(text) ? 'dark' : 'fade';
    notes.push(`gradient=${settings.gradient}`);
  }

  if (/\bmobile/.test(text)) {
    if (/\bsmaller typography\b|\bsmall/.test(text)) settings.mobile_heading_size = '24';
    if (/\breduced (?:padding|spacing)\b|\bless padding\b/.test(text)) settings.mobile_padding_y = '32';
    if (/\bfull[- ]width/.test(text)) settings.mobile_button_width = 'full';
    notes.push('mobile overrides');
  }

  if (!settings.bg_color && firstColor(text) && /\bbackground\b/.test(text) === false && /\bluxury\b/.test(text)) {
    /* keep luxury default black only when already handled */
  }

  const summary = notes.length
    ? `Extracted style: ${notes.join(', ')}.`
    : 'No explicit style tokens; use section defaults.';

  return { settings, notes, summary };
}

export function applyExtractedStyle(
  defaultSettings: Record<string, any>,
  extracted: Record<string, string>,
): Record<string, any> {
  const next = { ...defaultSettings };
  for (const [key, value] of Object.entries(extracted)) {
    if (value == null || value === '') continue;
    if ((key === 'heading_font_family' || key === 'body_font_family' || key === 'font_family') && !AI_FONT_VALUES.has(value as any)) {
      continue;
    }
    if (key === 'shadow' && !['none', 'soft', 'subtle', 'medium'].includes(value)) continue;
    if (key === 'gradient' && !['none', 'dark', 'gold', 'fade'].includes(value)) continue;
    if (key.endsWith('_color') || key.endsWith('_bg') || key.endsWith('_border') || key === 'button_bg') {
      if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) continue;
    }
    next[key] = value;
  }
  return next;
}
