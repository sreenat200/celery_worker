/**
 * Premium design token system — the single source of truth for AI-generated
 * section/page defaults and Inspector capability panels.
 *
 * Mirrors the canonical `shared/design-tokens.ts` (kept in-package to respect
 * per-package tsconfig rootDir boundaries).
 */

export const DESIGN_TOKENS = {
  colors: {
    primary: '#0F172A',
    secondary: '#475569',
    accent: '#F59E0B',
    background: '#FFFFFF',
    surface: '#F8FAFC',
    text_primary: '#0F172A',
    text_secondary: '#475569',
    text_inverse: '#FFFFFF',
    border: '#E2E8F0',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  },
  typography: {
    heading_font: 'Inter, system-ui, sans-serif',
    body_font: 'Inter, system-ui, sans-serif',
    scale: {
      display_large: { size: '4rem', line_height: '1.1', weight: '700' },
      display_medium: { size: '3rem', line_height: '1.2', weight: '700' },
      heading_1: { size: '2.25rem', line_height: '1.3', weight: '600' },
      heading_2: { size: '1.75rem', line_height: '1.35', weight: '600' },
      heading_3: { size: '1.375rem', line_height: '1.4', weight: '500' },
      body_large: { size: '1.125rem', line_height: '1.6', weight: '400' },
      body: { size: '1rem', line_height: '1.6', weight: '400' },
      body_small: { size: '0.875rem', line_height: '1.5', weight: '400' },
      caption: { size: '0.75rem', line_height: '1.4', weight: '400' },
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
    '4xl': '6rem',
    default_section_padding: '4rem',
    default_card_padding: '1.5rem',
  },
  shadows: {
    sm: '0 1px 2px rgba(0,0,0,0.05)',
    md: '0 4px 6px -1px rgba(0,0,0,0.1)',
    lg: '0 10px 15px -3px rgba(0,0,0,0.1)',
    xl: '0 20px 25px -5px rgba(0,0,0,0.1)',
    hover: '0 8px 12px -2px rgba(0,0,0,0.12)',
  },
  border_radius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    full: '9999px',
  },
  transitions: {
    fast: '150ms ease-in-out',
    normal: '250ms ease-in-out',
    slow: '400ms ease-in-out',
  },
} as const;

export type DesignTokenShadow = keyof typeof DESIGN_TOKENS.shadows;
export type DesignTokenRadius = keyof typeof DESIGN_TOKENS.border_radius;
export type DesignTokenTransition = keyof typeof DESIGN_TOKENS.transitions;

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
  { label: 'Zoom', value: 'zoom' },
  { label: 'Shadow', value: 'shadow' },
  { label: 'Glow', value: 'glow' },
] as const;

export const ANIMATION_SPEED_OPTIONS = [
  { label: 'Fast (150ms)', value: 'fast' },
  { label: 'Normal (250ms)', value: 'normal' },
  { label: 'Slow (400ms)', value: 'slow' },
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
  if (/^\d+(\.\d+)?(px|rem)?$/.test(v)) return v;
  return DESIGN_TOKENS.border_radius[v as DesignTokenRadius] || '';
}

export function resolveTransitionToken(value: string | undefined | null): string {
  if (!value) return DESIGN_TOKENS.transitions.normal;
  return DESIGN_TOKENS.transitions[value as DesignTokenTransition] || String(value);
}

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
