import { z } from 'zod';

// Allowed component primitives
export const AllowedComponentTypes = z.enum([
  'container',
  'row',
  'column',
  'grid',
  'stack',
  'heading',
  'text',
  'image',
  'video',
  'button',
  'product',
  'collection',
  'carousel',
]);

// Responsive properties (desktop, tablet, mobile) - allow any valid CSS style property
const ResponsiveStyleSchema = z.record(z.string(), z.union([z.string(), z.number()]));

const StyleSchema = z.object({
  desktop: ResponsiveStyleSchema.optional(),
  tablet: ResponsiveStyleSchema.optional(),
  mobile: ResponsiveStyleSchema.optional(),
});

// Recursive component node definition
export const AiElementNodeSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    type: AllowedComponentTypes,
    style: StyleSchema.optional(),
    props: z.record(z.string(), z.any()).optional(), // specific props like src, alt, variant
    children: z.array(AiElementNodeSchema).optional(),
  }).strict()
);

// The Inspector Schema definition for Theme Editor
const FieldSchema = z.object({
  type: z.enum(['text', 'color', 'image', 'video', 'number', 'select', 'toggle', 'link', 'richtext', 'resourcePicker', 'font']),
  label: z.string(),
  default: z.any().optional(),
  options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  resourceType: z.enum(['product', 'collection', 'page', 'menu']).optional(),
  category: z.string().optional(),
}).strict();

export const AiSectionBlueprintSchema = z.object({
  name: z.string().min(1),
  schema: z.record(z.string(), FieldSchema),
  defaultSettings: z.record(z.string(), z.any()),
  layout: AiElementNodeSchema,
}).strict();

export type AiSectionBlueprint = z.infer<typeof AiSectionBlueprintSchema>;
export type AiElementNode = z.infer<typeof AiElementNodeSchema>;
export type AiFieldSchema = z.infer<typeof FieldSchema>;
