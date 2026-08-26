import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { UniversalPageBlueprintSchema } from './universal-page-blueprint.schema';
import {
  derivePageType,
  getAllowedSectionsForPageType,
  getPrimitiveCapability,
  PRIMITIVE_CAPABILITIES,
  PAGE_TYPE_ALLOWED_SECTIONS,
} from './page-capability-registry';

describe('Universal Page Blueprint schema', () => {
  it('accepts a composable v2.0 page with nested section layouts', () => {
    const result = UniversalPageBlueprintSchema.safeParse({
      version: '2.0',
      page_type: 'homepage',
      title: 'Luxury Home',
      slug: 'luxury-home',
      seo: { title: 'Luxury Home', description: 'Premium fashion', og_image: '' },
      settings: { theme_preset: 'luxury_dark', primary_font: 'Inter', bg_color: '#FFFFFF' },
      sections: [
        {
          id: 'hero_1',
          type: 'hero',
          title: 'Hero',
          hidden: false,
          style: { desktop: { padding: '80px 24px' }, mobile: { padding: '40px 16px' } },
          settings: { title: 'Elevate', button_text: 'Shop Now' },
          blocks: [],
        },
        {
          id: 'custom_1',
          type: 'ai_custom',
          title: 'Bento',
          layout: {
            type: 'bento',
            children: [
              { type: 'bento_cell', children: [{ type: 'heading', props: { content: '{{settings.heading}}' } }] },
            ],
          },
          settings: { heading: 'Featured' },
        },
      ],
    });
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.page_type, 'homepage');
      assert.equal(result.data.sections[1].layout.type, 'bento');
    }
  });

  it('defaults to an empty sections array when sections are omitted', () => {
    const parsed = UniversalPageBlueprintSchema.safeParse({ title: 'X' });
    assert.equal(parsed.success, true);
    if (parsed.success) assert.deepEqual(parsed.data.sections, []);
  });

  it('rejects invalid page_type', () => {
    const bad = UniversalPageBlueprintSchema.safeParse({ title: 'X', page_type: 'bogus', sections: [] });
    assert.equal(bad.success, false);
  });
});

describe('page type derivation', () => {
  it('detects FAQ, contact, about, product, and collection pages', () => {
    assert.equal(derivePageType('FAQ page with questions and answers'), 'faq_page');
    assert.equal(derivePageType('contact us page with a form'), 'contact_page');
    assert.equal(derivePageType('about our story and values'), 'about_page');
    assert.equal(derivePageType('product detail page with gallery'), 'product_page');
    assert.equal(derivePageType('collection page to shop by category'), 'collection_page');
    assert.equal(derivePageType('landing page for a flash sale'), 'landing_page');
  });
});

describe('three-tier capability registry', () => {
  it('maps every page type to allowed sections', () => {
    for (const t of Object.keys(PAGE_TYPE_ALLOWED_SECTIONS)) {
      assert.ok(PAGE_TYPE_ALLOWED_SECTIONS[t as keyof typeof PAGE_TYPE_ALLOWED_SECTIONS]);
    }
  });

  it('custom_page allows any section; homepage restricts hero-only lists', () => {
    assert.equal(getAllowedSectionsForPageType('custom_page'), 'any');
    const homepage = getAllowedSectionsForPageType('homepage') as string[];
    assert.ok(homepage.includes('hero'));
    assert.ok(homepage.includes('featured_products'));
    assert.ok(!homepage.includes('product_template'));
  });

  it('declares capabilities per primitive', () => {
    const grid = getPrimitiveCapability('grid');
    assert.ok(grid?.supportsChildren);
    assert.ok(grid?.supportsRepeater);

    const heading = getPrimitiveCapability('heading');
    assert.equal(heading?.supportsChildren, false);

    const product = getPrimitiveCapability('product');
    assert.equal(product?.supportsCommerceBinding, true);
    assert.ok(product?.allowedBindingTypes.includes('product'));

    // every AI primitive has a capability declaration
    for (const type of Object.keys(PRIMITIVE_CAPABILITIES)) {
      assert.ok(PRIMITIVE_CAPABILITIES[type as keyof typeof PRIMITIVE_CAPABILITIES]);
    }
  });
});
