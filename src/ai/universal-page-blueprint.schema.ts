import { z } from 'zod';
import { AiElementNodeSchema } from './ai-blueprint.schema';

export const PAGE_TYPES = [
  'homepage',
  'product_page',
  'collection_page',
  'landing_page',
  'about_page',
  'contact_page',
  'faq_page',
  'campaign_page',
  'custom_page',
] as const;

export type PageType = (typeof PAGE_TYPES)[number];

const ResponsiveStyleSchema = z.record(z.string(), z.union([z.string(), z.number()]));

const SectionStyleSchema = z.object({
  desktop: ResponsiveStyleSchema.optional(),
  tablet: ResponsiveStyleSchema.optional(),
  mobile: ResponsiveStyleSchema.optional(),
});

export const UniversalSectionSchema = z
  .object({
    id: z.string().optional(),
    type: z.string().min(1),
    title: z.string().optional(),
    hidden: z.boolean().optional(),
    style: SectionStyleSchema.optional(),
    settings: z.record(z.string(), z.any()).optional(),
    layout: AiElementNodeSchema.optional(),
    blocks: z.array(z.any()).optional(),
  })
  .strict();

export const PageSeoSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    og_image: z.string().optional(),
  })
  .strict();

export const PageSettingsSchema = z
  .object({
    theme_preset: z.string().optional(),
    primary_font: z.string().optional(),
    body_font: z.string().optional(),
    bg_color: z.string().optional(),
    text_color: z.string().optional(),
    accent_color: z.string().optional(),
  })
  .strict();

export const UniversalPageBlueprintSchema = z
  .object({
    version: z.string().optional(),
    id: z.string().optional(),
    page_type: z.enum(PAGE_TYPES).optional(),
    title: z.string().min(1),
    slug: z.string().optional(),
    purpose: z.string().optional(),
    description: z.string().optional(),
    seo: PageSeoSchema.optional(),
    settings: PageSettingsSchema.optional(),
    sections: z.array(UniversalSectionSchema).default([]),
  })
  .strict();

export type UniversalPageBlueprint = z.infer<typeof UniversalPageBlueprintSchema>;
export type UniversalSection = z.infer<typeof UniversalSectionSchema>;
export type PageSeo = z.infer<typeof PageSeoSchema>;
export type PageSettings = z.infer<typeof PageSettingsSchema>;
