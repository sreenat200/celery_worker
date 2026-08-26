/**
 * Premium design token system — single source of truth for AI-generated
 * section defaults and Inspector capability panels.
 *
 * Mirrors `shared/design-tokens.json`. Kept as a TS module so renderers,
 * the style planner, and validators share the exact same values without
 * runtime JSON parsing.
 */
export const DESIGN_TOKENS = {
  color: {
    primary: '#0F172A',
    secondary: '#475569',
    accent: '#F59E0B',
    background: '#FFFFFF',
    surface: '#F8FAFC',
    text_primary: '#0F172A',
    text_secondary: '#475569',
    text_inverse: '#FFFFFF',
    border: '#E2E8F0',
  },
  shadows: {
    sm: '0 1px 2px rgba(0,0,0,0.05)',
    md: '0 4px 6px -1px rgba(0,0,0,0.1)',
    lg: '0 10px 15px -3px rgba(0,0,0,0.1)',
    xl: '0 20px 25px -5px rgba(0,0,0,0.1)',
    hover: '0 8px 12px -2px rgba(0,0,0,0.12)',
  },
  radius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    full: '9999px',
  },
  transitions: {
    fast: '150ms',
    normal: '250ms',
    slow: '400ms',
  },
} as const;

export type DesignTokenShadow = keyof typeof DESIGN_TOKENS.shadows;
export type DesignTokenRadius = keyof typeof DESIGN_TOKENS.radius;

/** Human-friendly shadow picker options for the Inspector. */
export const SHADOW_OPTIONS = [
  { label: 'None', value: 'none' },
  { label: 'Small', value: 'sm' },
  { label: 'Medium', value: 'md' },
  { label: 'Large', value: 'lg' },
  { label: 'Extra large', value: 'xl' },
] as const;

export const RADIUS_OPTIONS = [
  { label: 'Small', value: 'sm' },
  { label: 'Medium', value: 'md' },
  { label: 'Large', value: 'lg' },
  { label: 'Extra large', value: 'xl' },
  { label: 'Full / pill', value: 'full' },
] as const;

export const HOVER_EFFECT_OPTIONS = [
  { label: 'None', value: 'none' },
  { label: 'Lift', value: 'lift' },
  { label: 'Zoom image', value: 'zoom' },
  { label: 'Shadow', value: 'shadow' },
  { label: 'Glass', value: 'glass' },
] as const;

export const ANIMATION_SPEED_OPTIONS = [
  { label: 'Fast (150ms)', value: '150ms' },
  { label: 'Normal (250ms)', value: '250ms' },
  { label: 'Slow (400ms)', value: '400ms' },
] as const;

export function resolveShadowToken(value: string | undefined | null): string {
  if (!value) return 'none';
  const v = String(value).toLowerCase();
  if (v === 'none') return 'none';
  if (v === 'soft' || v === 'subtle' || v === 'sm') return DESIGN_TOKENS.shadows.sm;
  if (v === 'medium' || v === 'md') return DESIGN_TOKENS.shadows.md;
  if (v === 'large' || v === 'lg') return DESIGN_TOKENS.shadows.lg;
  if (v === 'xl') return DESIGN_TOKENS.shadows.xl;
  return DESIGN_TOKENS.shadows[v as DesignTokenShadow] || 'none';
}

export function resolveRadiusToken(value: string | undefined | null): string {
  if (!value) return '';
  const v = String(value);
  if (/^\d+(\.\d+)?(px)?$/.test(v)) return /px$/.test(v) ? v : `${v}px`;
  return DESIGN_TOKENS.radius[v as DesignTokenRadius] || '';
}

/** Node-level capability panel definitions shared with the Inspector. */
export const NODE_CAPABILITY_PANELS = [
  'Dimension & Spacing',
  'Flex/Grid Layout',
  'Typography',
  'Background & Media',
  'Border & Shadow',
  'Commerce Binding',
  'Responsive Toggle',
] as const;

export type NodeCapabilityPanel = (typeof NODE_CAPABILITY_PANELS)[number];
