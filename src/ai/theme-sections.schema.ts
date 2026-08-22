export interface FieldDefinition {
  type: 'text' | 'color' | 'image' | 'video' | 'gif' | 'media' | 'select' | 'number' | 'resourcePicker' | 'richtext' | 'toggle' | 'link' | 'font' | 'frames' | 'frame_slots';
  label: string;
  default?: string | number | boolean;
  options?: { label: string; value: string }[];
  resourceType?: 'product' | 'collection' | 'page' | 'menu';
  category?: string;
  mode?: string;
}

export interface SectionDefinition {
  type: string;
  label: string;
  category: string;
  description: string;
  supportsBlocks?: boolean;
  blockType?: string;
  blockLabel?: string;
  blockSchema?: Record<string, FieldDefinition>;
  defaultBlockSettings?: Record<string, any>;
  requiresApp?: string;
  fields: Record<string, FieldDefinition>;
  defaultSettings?: Record<string, any>;
}

export const THEME_SECTION_REGISTRY: Record<string, SectionDefinition> = {
  header: {
    type: 'header',
    label: 'Header',
    category: 'Layout',
    description: 'Main top navigation bar with logo, menu links, search bar, and cart icon',
    supportsBlocks: false,
    fields: {
      sticky_header: { type: 'toggle', label: 'Sticky Header', default: 'true' },
      transparent_overlay: { type: 'toggle', label: 'Transparent on Hero', default: 'false' },
      show_search: { type: 'toggle', label: 'Show Search Bar', default: 'true' },
      show_cart: { type: 'toggle', label: 'Show Cart Icon', default: 'true' },
      bg_color: { type: 'color', label: 'Background Color', default: '#ffffff' },
      text_color: { type: 'color', label: 'Text & Icon Color', default: '#111827' },
    },
  },
  footer: {
    type: 'footer',
    label: 'Footer',
    category: 'Layout',
    description: 'Multi-column footer with links, copyright notice, payment icons and social links',
    supportsBlocks: true,
    blockType: 'footer_column',
    blockLabel: 'Footer Column',
    blockSchema: {
      column_title: { type: 'text', label: 'Column Title', default: 'Quick Links' },
      column_type: {
        type: 'select',
        label: 'Column Type',
        options: [
          { label: 'Navigation Menu', value: 'menu' },
          { label: 'Rich Text / About', value: 'text' },
          { label: 'Newsletter Signup', value: 'newsletter' },
        ],
      },
      content: { type: 'richtext', label: 'Text Content' },
    },
    fields: {
      bg_color: { type: 'color', label: 'Background Color', default: '#111827' },
      text_color: { type: 'color', label: 'Text Color', default: '#9ca3af' },
      show_payment_icons: { type: 'toggle', label: 'Show Payment Icons', default: 'true' },
      show_social_icons: { type: 'toggle', label: 'Show Social Icons', default: 'true' },
      copyright_text: { type: 'text', label: 'Copyright Notice Text' },
    },
  },
  hero: {
    type: 'hero',
    label: 'Hero Banner',
    category: 'Hero',
    description: 'High-impact full-width hero banner with heading, description, dual action buttons, and background imagery',
    supportsBlocks: false,
    fields: {
      title: { type: 'text', label: 'Heading', default: 'Elevate Your Everyday Style' },
      subtitle_text: { type: 'text', label: 'Eyebrow / Badge Text', default: 'NEW ARRIVAL • 2026' },
      subtitle: { type: 'text', label: 'Description', default: 'Discover our new season collection crafted with timeless materials.' },
      hero_theme: {
        type: 'select',
        label: 'Theme Preset',
        options: [
          { label: 'Light', value: 'light' },
          { label: 'Dark', value: 'dark' },
          { label: 'Luxury', value: 'luxury' },
        ],
      },
      hero_layout: {
        type: 'select',
        label: 'Layout Style',
        options: [
          { label: 'Overlay', value: 'overlay' },
          { label: 'Split Two-Column', value: 'split' },
          { label: 'Glass Card', value: 'glass_card' },
          { label: 'Minimal Editorial', value: 'editorial' },
        ],
      },
      content_position: {
        type: 'select',
        label: 'Content Position',
        options: [
          { label: 'Top Left', value: 'top_left' },
          { label: 'Middle Center', value: 'middle_center' },
          { label: 'Bottom Left', value: 'bottom_left' },
          { label: 'Bottom Center', value: 'bottom_center' },
        ],
      },
      alignment: {
        type: 'select',
        label: 'Text Alignment',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Center', value: 'center' },
          { label: 'Right', value: 'right' },
        ],
      },
      button_text: { type: 'text', label: 'Primary Button Text', default: 'Shop Collection' },
      button_link: { type: 'link', label: 'Primary Button Link', default: '/collections' },
      btn2_text: { type: 'text', label: 'Secondary Button Text', default: 'Explore Catalog' },
      btn2_link: { type: 'link', label: 'Secondary Button Link', default: '/products' },
      bg_color: { type: 'color', label: 'Background Color', default: '#f8fafc' },
      title_color: { type: 'color', label: 'Title Color', default: '#0f172a' },
      text_color: { type: 'color', label: 'Text Color', default: '#334155' },
    },
  },
  ecommerce_hero: {
    type: 'ecommerce_hero',
    label: 'Ecommerce Hero',
    category: 'Hero',
    description: 'Commerce-focused promotional hero banner for sales, discounts, and product launches',
    supportsBlocks: false,
    fields: {
      heading: { type: 'text', label: 'Heading', default: 'Summer Sale' },
      subheading: { type: 'text', label: 'Subheading', default: 'Up to 50% off on all items' },
      buttonText: { type: 'text', label: 'Button Text', default: 'Shop Now' },
      bgColor: { type: 'color', label: 'Background Color', default: '#f3f4f6' },
      textColor: { type: 'color', label: 'Text Color', default: '#111827' },
    },
  },
  split_hero: {
    type: 'split_hero',
    label: 'Split Hero',
    category: 'Hero',
    description: 'Balanced two-column hero with media on one side and brand storytelling on the other',
    supportsBlocks: false,
    fields: {
      heading: { type: 'text', label: 'Heading', default: 'Discover our new collection' },
      subheading: { type: 'text', label: 'Subheading', default: 'Designed for comfort and style.' },
      buttonText: { type: 'text', label: 'Button Text', default: 'Explore' },
      imagePosition: {
        type: 'select',
        label: 'Image Position',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Right', value: 'right' },
        ],
      },
      bgColor: { type: 'color', label: 'Background Color', default: '#ffffff' },
      textColor: { type: 'color', label: 'Text Color', default: '#111827' },
    },
  },
  video_hero: {
    type: 'video_hero',
    label: 'Video Hero',
    category: 'Hero',
    description: 'Dynamic full-width video background hero banner',
    supportsBlocks: false,
    fields: {
      heading: { type: 'text', label: 'Heading', default: 'Experience the Magic' },
      subheading: { type: 'text', label: 'Subheading', default: 'Watch our latest brand video' },
      videoUrl: { type: 'video', label: 'Video URL' },
      overlayOpacity: { type: 'number', label: 'Overlay Opacity (0-100)', default: '50' },
    },
  },
  slider_hero: {
    type: 'slider_hero',
    label: 'Slider Hero',
    category: 'Hero',
    description: 'Multi-slide carousel banner for multiple featured promos',
    supportsBlocks: false,
    fields: {
      heading1: { type: 'text', label: 'Slide 1 Title', default: 'New Season Arrivals' },
      heading2: { type: 'text', label: 'Slide 2 Title', default: 'Exclusive Handcrafted Designs' },
      heading3: { type: 'text', label: 'Slide 3 Title', default: 'Limited Edition Release' },
      sliderSpeed: { type: 'number', label: 'Slide Transition Speed (ms)', default: '4000' },
    },
  },
  minimal_hero: {
    type: 'minimal_hero',
    label: 'Minimal Hero',
    category: 'Hero',
    description: 'Typography-driven editorial hero banner for luxury and clean brands',
    supportsBlocks: false,
    fields: {
      heading: { type: 'text', label: 'Heading', default: 'Simplicity is the ultimate sophistication' },
      textColor: { type: 'color', label: 'Text Color', default: '#000000' },
      bgColor: { type: 'color', label: 'Background Color', default: '#ffffff' },
    },
  },
  featured_products: {
    type: 'featured_products',
    label: 'Featured Products',
    category: 'Commerce',
    description: 'Responsive product grid or carousel showcasing key catalog items',
    supportsBlocks: false,
    fields: {
      title: { type: 'text', label: 'Section Title', default: 'Featured Products' },
      subtitle: { type: 'text', label: 'Subtitle', default: 'Handpicked favorites from our catalog' },
      eyebrow: { type: 'text', label: 'Eyebrow Tag', default: 'Trending Now' },
      limit: { type: 'number', label: 'Products Limit', default: '4' },
      columns_desktop: {
        type: 'select',
        label: 'Desktop Columns',
        options: [
          { label: '2 Columns', value: '2' },
          { label: '3 Columns', value: '3' },
          { label: '4 Columns', value: '4' },
          { label: '5 Columns', value: '5' },
        ],
      },
      columns_mobile: {
        type: 'select',
        label: 'Mobile Columns',
        options: [
          { label: '1 Column', value: '1' },
          { label: '2 Columns', value: '2' },
        ],
      },
      aspect_ratio: {
        type: 'select',
        label: 'Card Aspect Ratio',
        options: [
          { label: 'Square (1:1)', value: '1/1' },
          { label: 'Portrait (3:4)', value: '3/4' },
          { label: 'Landscape (16:9)', value: '16/9' },
        ],
      },
      show_price: { type: 'toggle', label: 'Show Price', default: 'true' },
      show_compare_at_price: { type: 'toggle', label: 'Show Original Price', default: 'true' },
      show_badges: { type: 'toggle', label: 'Show Badges', default: 'true' },
      show_quick_view: { type: 'toggle', label: 'Show Quick View', default: 'true' },
      button_text: { type: 'text', label: 'Button Text', default: 'View All Products' },
      button_link: { type: 'link', label: 'Button Link', default: '/products' },
    },
  },
  featured_product: {
    type: 'featured_product',
    label: 'Single Product Showcase',
    category: 'Commerce',
    description: 'Direct buy section for a hero product with gallery and variant selector',
    supportsBlocks: false,
    fields: {
      product_id: { type: 'resourcePicker', resourceType: 'product', label: 'Select Product' },
      show_gallery: { type: 'toggle', label: 'Show Media Gallery', default: 'true' },
      show_quantity: { type: 'toggle', label: 'Show Quantity Picker', default: 'true' },
      show_buy_now: { type: 'toggle', label: 'Show Direct Buy Button', default: 'true' },
    },
  },
  featured_collection: {
    type: 'featured_collection',
    label: 'Featured Collection',
    category: 'Commerce',
    description: 'Displays products dynamically from a specified collection',
    supportsBlocks: false,
    fields: {
      collectionId: { type: 'resourcePicker', resourceType: 'collection', label: 'Select Collection' },
      limit: { type: 'number', label: 'Products Limit', default: '4' },
    },
  },
  collection_list: {
    type: 'collection_list',
    label: 'Collection List',
    category: 'Commerce',
    description: 'Grid of category/collection cards with thumbnails and links',
    supportsBlocks: true,
    blockType: 'collection_card',
    blockLabel: 'Collection Card',
    blockSchema: {
      collection_id: { type: 'resourcePicker', resourceType: 'collection', label: 'Select Collection' },
      custom_title: { type: 'text', label: 'Custom Card Title' },
    },
    fields: {
      title: { type: 'text', label: 'Section Title', default: 'Shop by Category' },
      columns_desktop: {
        type: 'select',
        label: 'Desktop Columns',
        options: [
          { label: '2 Columns', value: '2' },
          { label: '3 Columns', value: '3' },
          { label: '4 Columns', value: '4' },
          { label: '6 Columns', value: '6' },
        ],
      },
      card_style: {
        type: 'select',
        label: 'Card Style',
        options: [
          { label: 'Solid White', value: 'solid' },
          { label: 'Glassmorphism', value: 'glass' },
          { label: 'Overlay Text', value: 'overlay' },
        ],
      },
      show_product_count: { type: 'toggle', label: 'Show Product Count', default: 'true' },
    },
  },
  collection_products: {
    type: 'collection_products',
    label: 'Collection Products Grid',
    category: 'Commerce',
    description: 'Full product grid with catalog filters and sorting',
    supportsBlocks: false,
    fields: {
      columns_desktop: {
        type: 'select',
        label: 'Desktop Columns',
        options: [
          { label: '3 Columns', value: '3' },
          { label: '4 Columns', value: '4' },
        ],
      },
      products_per_page: { type: 'number', label: 'Products Per Page', default: '16' },
    },
  },
  model_3d: {
    type: 'model_3d',
    label: '3D Model Interactive Viewer',
    category: 'Media',
    description: 'Interactive 3D model viewer with 360 rotation and AR mobile support',
    supportsBlocks: false,
    fields: {
      model: { type: 'media', mode: '3d_model', label: '3D Model Asset' },
      heading: { type: 'text', label: 'Heading', default: 'Experience in 3D' },
      subheading: { type: 'text', label: 'Subheading', default: 'Interactive Product Model' },
      auto_rotate: { type: 'toggle', label: 'Auto-Rotate', default: 'true' },
      enable_ar: { type: 'toggle', label: 'Enable AR View', default: 'true' },
      camera_controls: { type: 'toggle', label: 'Interactive Drag & Zoom', default: 'true' },
    },
  },
  frame_scroll_hero: {
    type: 'frame_scroll_hero',
    label: 'Premium Image Frames (Scroll Sequence)',
    category: 'Media',
    description: 'Apple-style interactive scroll-driven image sequence and product turntable',
    supportsBlocks: false,
    fields: {
      total_frames: { type: 'number', label: 'Total Frames', default: '60' },
      scroll_height_vh: { type: 'number', label: 'Scroll Height (vh)', default: '300' },
      overlay_heading: { type: 'text', label: 'Overlay Headline', default: 'Crafted to Perfection' },
      overlay_subheading: { type: 'text', label: 'Overlay Description', default: 'Rotate and explore every angle in real time.' },
    },
  },
  image_banner: {
    type: 'image_banner',
    label: 'Image Banner',
    category: 'Content',
    description: 'Promotional visual banner with title, description, and dual buttons',
    supportsBlocks: false,
    fields: {
      heading: { type: 'text', label: 'Heading', default: 'Mid-Season Sale' },
      subheading: { type: 'text', label: 'Subheading', default: 'Limited Time Exclusive' },
      description: { type: 'richtext', label: 'Description', default: '<p>Discover curated styles with exclusive discounts.</p>' },
      banner_height: {
        type: 'select',
        label: 'Banner Height',
        options: [
          { label: 'Small', value: 'small' },
          { label: 'Medium', value: 'medium' },
          { label: 'Large', value: 'large' },
          { label: 'Full Screen', value: 'fullscreen' },
        ],
      },
      button_text: { type: 'text', label: 'Button Text', default: 'Shop Now' },
      button_link: { type: 'link', label: 'Button Link', default: '#' },
      overlay_opacity: { type: 'number', label: 'Overlay Opacity', default: '40' },
    },
  },
  image_with_text: {
    type: 'image_with_text',
    label: 'Image with Text',
    category: 'Content',
    description: 'Side-by-side section pairing editorial imagery with text storytelling',
    supportsBlocks: false,
    fields: {
      heading: { type: 'text', label: 'Heading', default: 'Our Story' },
      subheading: { type: 'text', label: 'Subheading', default: 'About Us' },
      content: { type: 'richtext', label: 'Content', default: '<p>Learn more about our craftsmanship and heritage.</p>' },
      image_position: {
        type: 'select',
        label: 'Image Position',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Right', value: 'right' },
        ],
      },
      button_text: { type: 'text', label: 'Button Text', default: 'Learn More' },
      button_link: { type: 'link', label: 'Button Link', default: '#' },
    },
  },
  video: {
    type: 'video',
    label: 'Video Section',
    category: 'Content',
    description: 'Responsive video player supporting direct media URLs',
    supportsBlocks: false,
    fields: {
      title: { type: 'text', label: 'Section Title' },
      video_url: { type: 'video', label: 'Video URL' },
    },
  },
  countdown: {
    type: 'countdown',
    label: 'Countdown Timer',
    category: 'Content',
    description: 'Urgency countdown timer for flash sales and limited promotions',
    supportsBlocks: false,
    fields: {
      title: { type: 'text', label: 'Offer Title', default: 'Flash Sale Ends In' },
      end_date: { type: 'text', label: 'Target Date (YYYY-MM-DD HH:MM:SS)' },
      bg_color: { type: 'color', label: 'Background Color', default: '#111827' },
      text_color: { type: 'color', label: 'Text Color', default: '#ffffff' },
      button_text: { type: 'text', label: 'Button Text', default: 'Shop Sale' },
      button_link: { type: 'link', label: 'Button Link', default: '/collections' },
    },
  },
  testimonials: {
    type: 'testimonials',
    label: 'Testimonials',
    category: 'Marketing',
    description: 'Customer review quotes, star ratings, and social proof',
    supportsBlocks: true,
    blockType: 'testimonial',
    blockLabel: 'Testimonial',
    blockSchema: {
      author_name: { type: 'text', label: 'Customer Name', default: 'Sarah M.' },
      author_role: { type: 'text', label: 'Location / Tag', default: 'Verified Buyer' },
      quote: { type: 'richtext', label: 'Review Text', default: '<p>Exceptional quality and exquisite design!</p>' },
      rating: {
        type: 'select',
        label: 'Star Rating',
        options: [
          { label: '5 Stars', value: '5' },
          { label: '4 Stars', value: '4' },
          { label: '3 Stars', value: '3' },
        ],
      },
    },
    fields: {
      title: { type: 'text', label: 'Section Title', default: 'What Our Customers Say' },
      subtitle: { type: 'text', label: 'Subtitle', default: 'Real reviews from verified shoppers' },
      layout: {
        type: 'select',
        label: 'Layout',
        options: [
          { label: 'Slider / Carousel', value: 'slider' },
          { label: '3-Column Grid', value: 'grid' },
        ],
      },
    },
  },
  instagram_stories: {
    type: 'instagram_stories',
    label: 'Instagram Stories',
    category: 'Marketing',
    description: 'Instagram-like circular story bubbles with fullscreen preview',
    supportsBlocks: true,
    blockType: 'story',
    blockLabel: 'Story Item',
    blockSchema: {
      story_title: { type: 'text', label: 'Story Title', default: 'New Drops' },
      story_image: { type: 'image', label: 'Story Image' },
    },
    fields: {
      title: { type: 'text', label: 'Section Title', default: 'Featured Stories' },
      ring_gradient: {
        type: 'select',
        label: 'Ring Gradient',
        options: [
          { label: 'Instagram Sunset', value: 'sunset' },
          { label: 'Neon Purple / Cyan', value: 'neon' },
          { label: 'Solid Brand Color', value: 'solid' },
        ],
      },
    },
  },
  newsletter: {
    type: 'newsletter',
    label: 'Newsletter Signup',
    category: 'Marketing',
    description: 'Lead generation and email subscription box with discount incentive',
    supportsBlocks: false,
    fields: {
      heading: { type: 'text', label: 'Headline', default: 'Subscribe & Get 10% Off' },
      subheading: { type: 'text', label: 'Subheading', default: 'Be the first to know about new arrivals and private sales.' },
      button_text: { type: 'text', label: 'Button Label', default: 'Subscribe' },
      bg_color: { type: 'color', label: 'Background Color', default: '#f3f4f6' },
    },
  },
  rich_text: {
    type: 'rich_text',
    label: 'Rich Text',
    category: 'Content',
    description: 'Formatted editorial text content and announcements',
    supportsBlocks: false,
    fields: {
      title: { type: 'text', label: 'Heading' },
      text: { type: 'richtext', label: 'Text Content', default: '<p>Add your story here.</p>' },
    },
  },
  faq: {
    type: 'faq',
    label: 'FAQ Accordion',
    category: 'Content',
    description: 'Collapsible accordion for frequent questions and policies',
    supportsBlocks: true,
    blockType: 'faq_item',
    blockLabel: 'FAQ Item',
    blockSchema: {
      q: { type: 'text', label: 'Question', default: 'How long does shipping take?' },
      a: { type: 'richtext', label: 'Answer', default: '<p>Orders arrive in 3-5 business days.</p>' },
      open: { type: 'toggle', label: 'Open by default', default: 'false' },
    },
    fields: {
      title: { type: 'text', label: 'Section Title', default: 'Frequently Asked Questions' },
      faq_icon_type: {
        type: 'select',
        label: 'Icon Style',
        options: [
          { label: 'Chevron', value: 'chevron' },
          { label: 'Plus/Minus', value: 'plus_minus' },
        ],
      },
      faq_divider: {
        type: 'select',
        label: 'Divider Style',
        options: [
          { label: 'Separated Cards', value: 'separated' },
          { label: 'Joined Lines', value: 'joined' },
        ],
      },
    },
  },
  announcement_bar: {
    type: 'announcement_bar',
    label: 'Announcement Bar',
    category: 'Content',
    description: 'Top notification bar for free shipping and special offers',
    supportsBlocks: false,
    fields: {
      text: { type: 'text', label: 'Announcement Text', default: 'Free express shipping on orders over $50!' },
      bg_color: { type: 'color', label: 'Background Color', default: '#111827' },
      text_color: { type: 'color', label: 'Text Color', default: '#ffffff' },
    },
  },
  contact_form: {
    type: 'contact_form',
    label: 'Contact Form',
    category: 'Pages',
    description: 'Inquiry and contact message submission form',
    supportsBlocks: false,
    fields: {
      heading: { type: 'text', label: 'Form Heading', default: 'Get in Touch' },
    },
  },
  page_content: {
    type: 'page_content',
    label: 'Page Content',
    category: 'Pages',
    description: 'Dynamic CMS page content embed',
    supportsBlocks: false,
    fields: {
      pageSlug: { type: 'resourcePicker', resourceType: 'page', label: 'Select Page' },
    },
  },
  product_template: {
    type: 'product_template',
    label: 'Product Details Template',
    category: 'Product',
    description: 'Complete product detail page template with gallery, options, and buy buttons',
    supportsBlocks: true,
    blockType: 'product_addon',
    blockLabel: 'Product Addon',
    blockSchema: {
      title: { type: 'text', label: 'Widget Title' },
      content: { type: 'richtext', label: 'Widget Content' },
    },
    fields: {
      gallery_layout: {
        type: 'select',
        label: 'Gallery Layout',
        options: [
          { label: 'Thumbnails Left', value: 'thumbs_left' },
          { label: 'Thumbnails Bottom', value: 'thumbs_bottom' },
          { label: 'Grid', value: 'grid' },
        ],
      },
      enable_image_zoom: { type: 'toggle', label: 'Image Zoom', default: 'true' },
    },
  },
  product_reviews: {
    type: 'product_reviews',
    label: 'Customer Reviews',
    category: 'Product',
    description: 'Detailed customer reviews and rating submission form',
    supportsBlocks: false,
    fields: {
      title: { type: 'text', label: 'Section Title', default: 'Customer Reviews' },
    },
  },
  whatsapp: {
    type: 'whatsapp',
    label: 'WhatsApp Chat Button',
    category: 'Apps',
    requiresApp: 'whatsapp',
    description: 'Direct WhatsApp customer chat support floating button',
    supportsBlocks: false,
    fields: {
      phone_number: { type: 'text', label: 'WhatsApp Phone Number' },
      default_message: { type: 'text', label: 'Pre-filled Message', default: 'Hi! I have a question regarding my order.' },
      button_position: {
        type: 'select',
        label: 'Position',
        options: [
          { label: 'Bottom Right', value: 'bottom_right' },
          { label: 'Bottom Left', value: 'bottom_left' },
        ],
      },
    },
  },
  shipping_cod: {
    type: 'shipping_cod',
    label: 'Shipping / COD Checker',
    category: 'Apps',
    requiresApp: 'shipping-cod',
    description: 'Pincode delivery and Cash On Delivery eligibility checker',
    supportsBlocks: false,
    fields: {
      title: { type: 'text', label: 'Title', default: 'Check Delivery & COD' },
      placeholder: { type: 'text', label: 'Placeholder Text', default: 'Enter your Pincode' },
    },
  },
};

/**
 * Serialize a clean, compact schema representation specifically tailored for LLM prompt context.
 * Filters out layout chrome (header/footer) and condenses settings into a concise structure to minimize token count.
 */
export function getSectionSchemaPromptContext(): string {
  const simplified: Record<string, any> = {};

  for (const [type, def] of Object.entries(THEME_SECTION_REGISTRY)) {
    if (type === 'header' || type === 'footer') continue;

    const fieldsSummary: Record<string, any> = {};
    for (const [fieldName, fieldDef] of Object.entries(def.fields)) {
      if (fieldDef.options) {
        fieldsSummary[fieldName] = fieldDef.options.map((o) => o.value);
      } else if (fieldDef.type === 'toggle') {
        fieldsSummary[fieldName] = 'boolean';
      } else if (fieldDef.type === 'number') {
        fieldsSummary[fieldName] = 'number';
      } else if (fieldDef.type === 'color') {
        fieldsSummary[fieldName] = 'hex_color';
      } else {
        fieldsSummary[fieldName] = fieldDef.type;
      }
    }

    simplified[type] = {
      label: def.label,
      category: def.category,
      desc: def.description,
      blocks: Boolean(def.supportsBlocks),
      settings: fieldsSummary,
    };
  }

  return JSON.stringify(simplified);
}
