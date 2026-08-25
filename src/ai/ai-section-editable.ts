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
  card_bg: { type: 'color', label: 'Card background', category: 'style', default: '#ffffff' },
  card_text_color: { type: 'color', label: 'Card text', category: 'style', default: '#111827' },
  mobile_layout: {
    type: 'select',
    label: 'Mobile layout',
    category: 'mobile',
    default: 'stack',
    options: [
      { label: 'Stack', value: 'stack' },
      { label: 'Carousel', value: 'carousel' },
    ],
  },
  tablet_columns: { type: 'select', label: 'Tablet columns', category: 'mobile', default: '2', options: [{ label: '1', value: '1' }, { label: '2', value: '2' }, { label: '3', value: '3' }] },
  empty_heading: { type: 'text', label: 'Empty heading', category: 'content', default: 'Nothing here yet' },
  empty_description: { type: 'text', label: 'Empty description', category: 'content', default: 'Add items in the sidebar.' },
  empty_image: { type: 'image', label: 'Empty image', category: 'content', default: '' },
  tablet_heading_size: { type: 'number', label: 'Tablet heading size', category: 'typography', default: '32' },
  eyebrow: { type: 'text', label: 'Eyebrow', category: 'content', default: '' },
  eyebrow_transform: { type: 'select', label: 'Eyebrow case', category: 'typography', default: 'uppercase', options: [{ label: 'None', value: 'none' }, { label: 'Uppercase', value: 'uppercase' }] },
  button_hover_bg: { type: 'color', label: 'Button hover background', category: 'button', default: '' },
  button_hover_color: { type: 'color', label: 'Button hover text', category: 'button', default: '' },
  testimonial_columns: { type: 'select', label: 'Testimonial columns', category: 'layout', default: '3', options: [{ label: '3', value: '3' }, { label: '2', value: '2' }, { label: '4', value: '4' }] },
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
    fields.enable_quantity = { type: 'toggle', label: 'Quantity selector', category: 'content', default: false };
  }
  if (types.has('collection')) {
    fields.collection_title = { type: 'text', label: 'Collection title', category: 'content', default: 'Collection' };
    fields.collection_image = { type: 'image', label: 'Collection image', category: 'content', default: '' };
    fields.collection_id = { type: 'resourcePicker', label: 'Collection', category: 'content', resourceType: 'collection' };
    fields.collection_1_cta = { type: 'text', label: 'Card 1 button', category: 'button', default: 'Shop Now' };
    fields.collection_1 = { type: 'resourcePicker', label: 'Card 1 collection', category: 'content', resourceType: 'collection' };
    fields.collection_1_border_color = { type: 'color', label: 'Card 1 border', category: 'style', default: '' };
  }
  if (types.has('recommend')) {
    fields.recommend_show_rating = { type: 'toggle', label: 'Show rating', category: 'content', default: true };
    fields.recommend_show_atc = { type: 'toggle', label: 'Show Add to Cart', category: 'content', default: true };
    fields.recommend_show_qty = { type: 'toggle', label: 'Quantity selector', category: 'content', default: false };
    fields.recommend_layout = { type: 'select', label: 'Recommend layout', category: 'layout', default: 'carousel', options: [{ label: 'Carousel', value: 'carousel' }, { label: 'Grid', value: 'grid' }] };
    fields.recommend_card_bg = { type: 'color', label: 'Recommend card bg', category: 'style', default: '' };
  }
  if (types.has('before_after')) {
    fields.before_label = { type: 'text', label: 'Before label', category: 'content', default: 'Before' };
    fields.after_label = { type: 'text', label: 'After label', category: 'content', default: 'After' };
  }
  if (types.has('tabs')) {
    fields.tab_1_collection_id = { type: 'resourcePicker', label: 'Tab 1 collection', category: 'content', resourceType: 'collection' };
    fields.tab_2_collection_id = { type: 'resourcePicker', label: 'Tab 2 collection', category: 'content', resourceType: 'collection' };
    fields.tab_3_collection_id = { type: 'resourcePicker', label: 'Tab 3 collection', category: 'content', resourceType: 'collection' };
    fields.tab_4_collection_id = { type: 'resourcePicker', label: 'Tab 4 collection', category: 'content', resourceType: 'collection' };
  }
  if (types.has('icon')) {
    fields.icon_1_bg = { type: 'color', label: 'Icon 1 background', category: 'style', default: '' };
  }
  if (types.has('accordion') || types.has('newsletter') || types.has('countdown') || types.has('stories') || types.has('contact_form')) {
    fields.heading = fields.heading || { type: 'text', label: 'Heading', category: 'content', default: 'Heading' };
  }
  if (types.has('newsletter')) {
    fields.placeholder = { type: 'text', label: 'Email placeholder', category: 'content', default: 'Email address' };
    fields.button_text = fields.button_text || { type: 'text', label: 'Button label', category: 'button', default: 'Subscribe' };
  }
  if (types.has('countdown')) {
    fields.end_date = { type: 'datetime', label: 'Sale end date', category: 'content', default: '' };
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
    fields.grid_show_rating = { type: 'toggle', label: 'Show rating', category: 'content', default: false };
    fields.grid_show_qty = { type: 'toggle', label: 'Quantity selector', category: 'content', default: false };
    fields.grid_show_atc = { type: 'toggle', label: 'Show Add to Cart', category: 'content', default: false };
  }
  if (types.has('slider')) {
    fields.interval = { type: 'number', label: 'Autoplay ms', category: 'content', default: '4000' };
  }
  return fields;
}

function chromeForTypes(types: Set<string>): Record<string, Field> {
  const has = (...t: string[]) => t.some((x) => types.has(x));
  const keys = ['bg_color', 'padding_y', 'padding_x', 'gap', 'text_align'];
  if (has('heading')) keys.push('heading_color', 'heading_font_family', 'heading_size', 'font_weight');
  if (has('text')) keys.push('text_color', 'body_font_family', 'body_size', 'line_height');
  if (has('heading') && !has('text')) keys.push('text_color');
  if (has('row') && has('image', 'video')) keys.push('alignment', 'image_position');
  if (has('image') && !has('before_after')) keys.push('image_width');
  if (has('video')) keys.push('video_autoplay', 'video_controls', 'video_muted');
  if (has('newsletter', 'contact_form', 'whatsapp', 'shipping') && !has('button')) {
    keys.push('button_bg', 'button_text_color', 'button_radius');
  }
  if (has('grid', 'product', 'collection', 'icon', 'collection_grid', 'bento', 'masonry', 'recommend', 'testimonial')) {
    keys.push('columns', 'tablet_columns');
  }
  if (has('product', 'collection', 'icon', 'testimonial', 'recommend', 'accordion')) {
    keys.push('card_bg', 'card_text_color');
  }
  if (has('testimonial')) keys.push('testimonial_columns');
  const out: Record<string, Field> = {};
  keys.forEach((k) => {
    if (AI_CHROME_SCHEMA[k]) out[k] = AI_CHROME_SCHEMA[k];
  });
  return out;
}

function isAllowedPersistedKey(key: string, types: Set<string>): boolean {
  if (!key || key === 'blueprint' || key === 'layout') return false;
  const has = (...t: string[]) => t.some((x) => types.has(x));
  if (['bg_color', 'padding_y', 'padding_x', 'gap', 'text_align', 'shadow'].includes(key)) return true;
  if (key === 'poster') return has('video');
  if (/^heading/.test(key) || key === 'font_weight') return has('heading');
  if (/^text_\d+$/.test(key) || key === 'subheading') return has('text');
  if (/^caption_\d+$/.test(key)) return has('image');
  if (['subheading', 'body_font_family', 'body_size', 'line_height'].includes(key)) return has('text');
  if (key === 'text_color') return has('heading', 'text');
  if (/^image/.test(key) || key === 'image_position' || key === 'alignment') return has('image', 'video', 'row');
  if (/^video/.test(key)) return has('video');
  if (/^button/.test(key)) return has('button', 'newsletter', 'contact_form', 'whatsapp', 'shipping');
  if (['columns', 'tablet_columns'].includes(key)) return has('grid', 'product', 'collection', 'icon', 'collection_grid', 'bento', 'masonry', 'recommend', 'testimonial');
  if (/^card_/.test(key) || key === 'border_radius') return has('product', 'collection', 'icon', 'testimonial', 'recommend', 'accordion', 'image', 'video');
  if (/^product/.test(key) || key === 'enable_quantity' || key === 'show_rating') return has('product', 'recommend', 'product_detail', 'reviews', 'specs', 'comparison_table', 'hotspot');
  if (/^collection/.test(key) || key === 'limit') return has('collection', 'collection_grid', 'filters');
  if (/^faq_/.test(key) || /^accordion/.test(key)) return has('accordion');
  if (/^t_\d+_/.test(key) || /^testimonial/.test(key)) return has('testimonial');
  if (/^before|^after/.test(key)) return has('before_after');
  if (key === 'end_date') return has('countdown');
  if (key === 'placeholder') return has('newsletter');
  if (key === 'phone' || key === 'greeting') return has('whatsapp');
  if (key === 'cod_message') return has('shipping');
  if (key === 'pageSlug') return has('page_content');
  if (key === 'model') return has('model3d');
  if (key === 'interval' || /^slide_/.test(key)) return has('slider', 'slide');
  if (/^tab_/.test(key)) return has('tabs', 'tab');
  if (/^tl_/.test(key) || key === 'orientation') return has('timeline', 'before_after');
  if (/^pin_/.test(key)) return has('hotspot');
  if (/^icon_/.test(key)) return has('icon');
  if (/^logo_/.test(key) || key === 'marquee_text' || key === 'speed') return has('marquee');
  if (/^spec_/.test(key)) return has('specs');
  if (/^size_/.test(key)) return has('size_guide');
  if (/^frame_/.test(key)) return has('frame_scroll');
  if (/^row_\d+_position$/.test(key)) return has('row');
  if (/^cell_\d+_/.test(key)) return has('bento', 'bento_cell');
  if (/^before_\d+$/.test(key) || /^after_\d+$/.test(key) || /^before_label_\d+$/.test(key) || /^after_label_\d+$/.test(key)) return has('before_after');
  if (key === 'mobile_layout') return has('grid', 'product', 'collection', 'collection_grid', 'bento', 'recommend');
  if (key === 'shadow' || key === 'hover_effect') return has('product', 'collection', 'icon', 'testimonial', 'recommend', 'bento_cell');
  if (key === 'compare_show_buy' || key === 'compare_show_qty' || key === 'compare_show_atc') return has('comparison_table');
  if (/^row_\d+_/.test(key)) return has('row', 'comparison_table');
  if (/^recommend/.test(key) || /^recommendation_/.test(key)) return has('recommend');
  if (/^grid_show_/.test(key)) return has('collection_grid', 'filters');
  if (key === 'product_id') return has('reviews', 'product_detail', 'specs', 'recommend');
  return false;
}

export function mergeEditableBlueprint(input: {
  name: string;
  schema: Record<string, any>;
  defaultSettings: Record<string, any>;
  layout: any;
}) {
  const types = collectTypes(input.layout);
  const inferred = inferContent(types);
  const chrome = chromeForTypes(types);
  const schema: Record<string, any> = { ...inferred, ...chrome };
  Object.entries(input.schema || {}).forEach(([key, field]) => {
    if (isAllowedPersistedKey(key, types) && field && typeof field === 'object') {
      schema[key] = schema[key] || field;
    }
  });
  delete schema.blueprint;
  if (hasProductChrome(types)) {
    delete schema.product_link;
    delete schema.product_url;
    delete schema.product_href;
    delete schema.product_title;
    delete schema.product_price;
    delete schema.product_image;
  }

  const defaultSettings: Record<string, any> = {};
  for (const [key, field] of Object.entries(schema)) {
    if (!field.category && AI_CHROME_SCHEMA[key]) field.category = AI_CHROME_SCHEMA[key].category;
    const incoming = input.defaultSettings?.[key];
    defaultSettings[key] = incoming !== undefined ? incoming : field.default;
  }

  return { ...input, schema, defaultSettings };
}

function hasProductChrome(types: Set<string>) {
  return types.has('product') || types.has('recommend') || types.has('product_detail') || types.has('reviews');
}
