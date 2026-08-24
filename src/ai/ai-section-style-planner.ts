export const AI_FONT_OPTIONS = [
  { label: 'Inter', value: 'Inter' },
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
  if (/\bserif\b|\belegan(t)?\b|\bluxury\b/.test(text)) return 'Playfair Display';
  if (/\bsans\b|\bmodern\b/.test(text)) return 'Inter';
  return undefined;
}

export function planSectionStyle(userPrompt: string): SectionStylePlan {
  const text = (userPrompt || '').toLowerCase();
  const settings: Record<string, string> = {};
  const notes: string[] = [];

  const bg = colorAfter(text, /(?:background|bg)(?:\s+\w+){0,4}/);
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

  const font = detectFont(text);
  if (font) {
    settings.heading_font_family = font;
    if (/\bserif\b|\bluxury\b|\belegan/.test(text)) settings.body_font_family = font === 'Playfair Display' ? 'Lora' : font;
    notes.push(`heading_font_family=${font}`);
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

  if (/\bfull[- ]width buttons?\b/.test(text)) {
    settings.button_width = 'full';
    settings.mobile_button_width = 'full';
    notes.push('button_width=full');
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
    if (key.endsWith('_color') || key === 'button_bg') {
      if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) continue;
    }
    next[key] = value;
  }
  return next;
}
