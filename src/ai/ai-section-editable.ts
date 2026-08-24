type Field = {
  type: string;
  label: string;
  category?: string;
  default?: any;
  options?: Array<{ label: string; value: string }>;
  resourceType?: 'product' | 'collection' | 'page' | 'menu';
};

export const AI_CHROME_SCHEMA: Record<string, Field> = {
  section_width: {
    type: 'select',
    label: 'Section width',
    category: 'layout',
    default: 'boxed',
    options: [
      { label: 'Boxed', value: 'boxed' },
      { label: 'Full width', value: 'full' },
    ],
  },
  content_width: {
    type: 'select',
    label: 'Content width',
    category: 'layout',
    default: '1200',
    options: [
      { label: 'Narrow (800)', value: '800' },
      { label: 'Medium (1000)', value: '1000' },
      { label: 'Wide (1200)', value: '1200' },
      { label: 'Extra wide (1400)', value: '1400' },
    ],
  },
  direction: {
    type: 'select',
    label: 'Desktop direction',
    category: 'layout',
    default: 'row',
    options: [
      { label: 'Horizontal', value: 'row' },
      { label: 'Vertical', value: 'column' },
    ],
  },
  alignment: {
    type: 'select',
    label: 'Content alignment',
    category: 'layout',
    default: 'left',
    options: [
      { label: 'Left', value: 'left' },
      { label: 'Center', value: 'center' },
      { label: 'Right', value: 'right' },
    ],
  },
  vertical_align: {
    type: 'select',
    label: 'Vertical alignment',
    category: 'layout',
    default: 'center',
    options: [
      { label: 'Top', value: 'flex-start' },
      { label: 'Center', value: 'center' },
      { label: 'Bottom', value: 'flex-end' },
    ],
  },
  gap: { type: 'number', label: 'Gap', category: 'layout', default: '32' },
  padding_y: { type: 'number', label: 'Vertical padding', category: 'layout', default: '48' },
  padding_x: { type: 'number', label: 'Horizontal padding', category: 'layout', default: '24' },
  image_position: {
    type: 'select',
    label: 'Image / media position',
    category: 'layout',
    default: 'left',
    options: [
      { label: 'Left', value: 'left' },
      { label: 'Right', value: 'right' },
    ],
  },
  image_width: {
    type: 'select',
    label: 'Media width',
    category: 'layout',
    default: '50',
    options: [
      { label: '40%', value: '40' },
      { label: '50%', value: '50' },
      { label: '60%', value: '60' },
    ],
  },
  columns: {
    type: 'select',
    label: 'Desktop columns',
    category: 'layout',
    default: '3',
    options: [
      { label: '2', value: '2' },
      { label: '3', value: '3' },
      { label: '4', value: '4' },
    ],
  },
  heading_font: { type: 'font', label: 'Heading font', category: 'typography', default: 'Inter' },
  heading_font_family: { type: 'font', label: 'Heading font family', category: 'typography', default: 'Inter' },
  body_font_family: { type: 'font', label: 'Body font family', category: 'typography', default: 'Inter' },
  font_weight: {
    type: 'select',
    label: 'Heading weight',
    category: 'typography',
    default: '700',
    options: [
      { label: 'Regular', value: '400' },
      { label: 'Medium', value: '500' },
      { label: 'Semibold', value: '600' },
      { label: 'Bold', value: '700' },
    ],
  },
  heading_size: { type: 'number', label: 'Heading size', category: 'typography', default: '36' },
  heading_weight: {
    type: 'select',
    label: 'Heading weight',
    category: 'typography',
    default: '700',
    options: [
      { label: 'Regular', value: '400' },
      { label: 'Medium', value: '500' },
      { label: 'Semibold', value: '600' },
      { label: 'Bold', value: '700' },
    ],
  },
  body_font: { type: 'font', label: 'Body font', category: 'typography', default: 'Inter' },
  body_size: { type: 'number', label: 'Body size', category: 'typography', default: '16' },
  line_height: {
    type: 'select',
    label: 'Line height',
    category: 'typography',
    default: '1.6',
    options: [
      { label: 'Tight', value: '1.3' },
      { label: 'Normal', value: '1.6' },
      { label: 'Relaxed', value: '1.8' },
    ],
  },
  letter_spacing: { type: 'number', label: 'Letter spacing', category: 'typography', default: '0' },
  text_align: {
    type: 'select',
    label: 'Text alignment',
    category: 'typography',
    default: 'left',
    options: [
      { label: 'Left', value: 'left' },
      { label: 'Center', value: 'center' },
      { label: 'Right', value: 'right' },
    ],
  },
  bg_color: { type: 'color', label: 'Background color', category: 'style', default: '#ffffff' },
  text_color: { type: 'color', label: 'Text color', category: 'style', default: '#111827' },
  heading_color: { type: 'color', label: 'Heading color', category: 'style', default: '#111827' },
  button_bg: { type: 'color', label: 'Button color', category: 'button', default: '#111827' },
  button_text_color: { type: 'color', label: 'Button text color', category: 'button', default: '#ffffff' },
  button_border_color: { type: 'color', label: 'Button border color', category: 'button', default: '#111827' },
  button_border_width: { type: 'number', label: 'Button border width', category: 'button', default: '0' },
  button_radius: { type: 'number', label: 'Button radius', category: 'button', default: '8' },
  button_width: {
    type: 'select',
    label: 'Button width',
    category: 'button',
    default: 'auto',
    options: [
      { label: 'Auto', value: 'auto' },
      { label: 'Full', value: 'full' },
    ],
  },
  button_height: { type: 'number', label: 'Button height', category: 'button', default: '44' },
  border_color: { type: 'color', label: 'Border color', category: 'style', default: '#e5e7eb' },
  border_width: { type: 'number', label: 'Border width', category: 'style', default: '0' },
  border_style: {
    type: 'select',
    label: 'Border style',
    category: 'style',
    default: 'solid',
    options: [
      { label: 'Solid', value: 'solid' },
      { label: 'Dashed', value: 'dashed' },
      { label: 'None', value: 'none' },
    ],
  },
  border_radius: { type: 'number', label: 'Corner radius', category: 'style', default: '12' },
  overlay_opacity: { type: 'number', label: 'Overlay %', category: 'style', default: '0' },
  gradient: {
    type: 'select',
    label: 'Gradient',
    category: 'style',
    default: 'none',
    options: [
      { label: 'None', value: 'none' },
      { label: 'Dark', value: 'dark' },
      { label: 'Gold', value: 'gold' },
      { label: 'Fade', value: 'fade' },
    ],
  },
  shadow: {
    type: 'select',
    label: 'Shadow',
    category: 'style',
    default: 'none',
    options: [
      { label: 'None', value: 'none' },
      { label: 'Soft', value: 'soft' },
      { label: 'Medium', value: 'medium' },
    ],
  },
  opacity: { type: 'number', label: 'Opacity (%)', category: 'style', default: '100' },
  mobile_stack: {
    type: 'select',
    label: 'Mobile stacking',
    category: 'mobile',
    default: 'column',
    options: [
      { label: 'Media above text', value: 'column' },
      { label: 'Text above media', value: 'column-reverse' },
    ],
  },
  mobile_gap: { type: 'number', label: 'Mobile gap', category: 'mobile', default: '20' },
  mobile_padding: { type: 'number', label: 'Mobile padding', category: 'mobile', default: '32' },
  mobile_padding_y: { type: 'number', label: 'Mobile padding Y', category: 'mobile', default: '32' },
  mobile_heading_size: { type: 'number', label: 'Mobile heading size', category: 'mobile', default: '28' },
  mobile_button_width: {
    type: 'select',
    label: 'Mobile button width',
    category: 'mobile',
    default: 'auto',
    options: [
      { label: 'Auto', value: 'auto' },
      { label: 'Full', value: 'full' },
    ],
  },
  margin: { type: 'number', label: 'Margin', category: 'layout', default: '0' },
  mobile_text_align: {
    type: 'select',
    label: 'Mobile text align',
    category: 'mobile',
    default: 'left',
    options: [
      { label: 'Left', value: 'left' },
      { label: 'Center', value: 'center' },
      { label: 'Right', value: 'right' },
    ],
  },
  mobile_image_width: {
    type: 'select',
    label: 'Mobile media width',
    category: 'mobile',
    default: '100',
    options: [
      { label: 'Full', value: '100' },
      { label: '80%', value: '80' },
    ],
  },
  video_autoplay: { type: 'toggle', label: 'Video autoplay', category: 'advanced', default: false },
  video_controls: { type: 'toggle', label: 'Video controls', category: 'advanced', default: true },
  video_muted: { type: 'toggle', label: 'Video muted', category: 'advanced', default: true },
};

function collectTypes(node: any, acc: Set<string> = new Set()): Set<string> {
  if (!node || typeof node !== 'object') return acc;
  if (typeof node.type === 'string') acc.add(node.type);
  if (Array.isArray(node.children)) node.children.forEach((child: any) => collectTypes(child, acc));
  return acc;
}

function inferContent(types: Set<string>): Record<string, Field> {
  const fields: Record<string, Field> = {};
  if (types.has('heading')) fields.heading = { type: 'text', label: 'Heading', category: 'content', default: 'Heading' };
  if (types.has('text')) fields.subheading = { type: 'richtext', label: 'Description', category: 'content', default: '' };
  if (types.has('image')) fields.image = { type: 'image', label: 'Image', category: 'content', default: '' };
  if (types.has('video')) fields.video = { type: 'video', label: 'Video', category: 'content', default: '' };
  if (types.has('button')) {
    fields.button_text = { type: 'text', label: 'Button label', category: 'button', default: 'Shop Now' };
    fields.button_link = { type: 'link', label: 'Button link', category: 'button', default: '/collections' };
  }
  if (types.has('product')) {
    fields.product_id = { type: 'resourcePicker', label: 'Product', category: 'content', resourceType: 'product' };
  }
  if (types.has('collection')) {
    fields.collection_title = { type: 'text', label: 'Collection title', category: 'content', default: 'Collection' };
    fields.collection_image = { type: 'image', label: 'Collection image', category: 'content', default: '' };
    fields.collection_id = { type: 'resourcePicker', label: 'Collection', category: 'content', resourceType: 'collection' };
  }
  if (types.has('accordion') || types.has('newsletter') || types.has('countdown') || types.has('stories') || types.has('contact_form')) {
    fields.heading = fields.heading || { type: 'text', label: 'Heading', category: 'content', default: 'Heading' };
  }
  if (types.has('newsletter')) {
    fields.placeholder = { type: 'text', label: 'Email placeholder', category: 'content', default: 'Email address' };
    fields.button_text = fields.button_text || { type: 'text', label: 'Button label', category: 'button', default: 'Subscribe' };
  }
  if (types.has('countdown')) {
    fields.end_date = { type: 'text', label: 'End date', category: 'content', default: '' };
  }
  if (types.has('model3d')) {
    fields.model = { type: 'text', label: '3D model URL', category: 'content', default: '' };
  }
  if (types.has('contact_form')) {
    fields.button_text = fields.button_text || { type: 'text', label: 'Button label', category: 'button', default: 'Send' };
  }
  if (types.has('page_content')) {
    fields.pageSlug = { type: 'resourcePicker', label: 'Page', category: 'content', resourceType: 'page' };
  }
  if (types.has('reviews') || types.has('product_detail')) {
    fields.product_id = { type: 'resourcePicker', label: 'Product', category: 'content', resourceType: 'product' };
  }
  if (types.has('collection_grid')) {
    fields.collection_id = { type: 'resourcePicker', label: 'Collection', category: 'content', resourceType: 'collection' };
    fields.limit = { type: 'number', label: 'Product count', category: 'content', default: '4' };
  }
  if (types.has('slider')) {
    fields.interval = { type: 'number', label: 'Autoplay ms', category: 'content', default: '4000' };
  }
  return fields;
}

export function mergeEditableBlueprint(input: {
  name: string;
  schema: Record<string, any>;
  defaultSettings: Record<string, any>;
  layout: any;
}) {
  const types = collectTypes(input.layout);
  const inferred = inferContent(types);
  const schema: Record<string, any> = {
    ...AI_CHROME_SCHEMA,
    ...inferred,
    ...input.schema,
  };
  delete schema.blueprint;

  if (!types.has('video')) {
    delete schema.video_autoplay;
    delete schema.video_controls;
    delete schema.video_muted;
  }
  if (!types.has('image') && !types.has('video')) {
    delete schema.image_position;
    delete schema.image_width;
    delete schema.mobile_image_width;
  }
  if (!types.has('grid') && !types.has('product') && !types.has('collection') && !types.has('icon') && !types.has('collection_grid')) delete schema.columns;
  if (!types.has('button') && !types.has('newsletter') && !types.has('contact_form') && !types.has('slider')) {
    /* keep button chrome so extracted styles remain editable */
  }
  if (!types.has('row') && !types.has('carousel')) delete schema.direction;

  const productLike = types.has('product') || Object.keys(schema).some((k) => /product/i.test(k));
  if (productLike) {
    schema.product_id = {
      type: 'resourcePicker',
      label: 'Product',
      category: 'content',
      resourceType: 'product',
    };
    delete schema.product_link;
    delete schema.product_url;
    delete schema.product_href;
    delete schema.product_title;
    delete schema.product_price;
    delete schema.product_image;
    if (schema.product && schema.product.type !== 'resourcePicker') delete schema.product;
  }

  const defaultSettings = { ...input.defaultSettings };
  for (const [key, field] of Object.entries(schema)) {
    if (!field.category && AI_CHROME_SCHEMA[key]) field.category = AI_CHROME_SCHEMA[key].category;
    if (defaultSettings[key] === undefined) defaultSettings[key] = field.default;
  }

  return { ...input, schema, defaultSettings };
}
