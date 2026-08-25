import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AI_COMPONENT_TYPES } from './ai-section-component-registry';
import { validateAiSectionBlueprint, AiSectionValidationError } from './ai-section-validator';
import { planSectionLayout } from './ai-section-layout-planner';
import { composeBlueprint, shouldCompose } from './ai-section-compose';
import { collectResourceRefs } from './ai-section-resources';
import { isFaqPrompt, isLuxuryComboPrompt, isRepeatingRowsPrompt, isSimpleBannerPrompt, synthesizeFaqBlueprint, synthesizeLuxuryComboBlueprint, synthesizeRepeatingRowsBlueprint, synthesizeSimpleBannerBlueprint } from './ai-section-synthesize';
import { planSectionStyle } from './ai-section-style-planner';

const shared = JSON.parse(
  readFileSync(join(__dirname, '../../../shared/ai-section-registry.json'), 'utf8'),
);

describe('AI section registry sync', () => {
  it('matches shared component type list', () => {
    assert.deepEqual([...AI_COMPONENT_TYPES].sort(), [...shared.componentTypes].sort());
  });

  it('frontend and nest schemas include every shared type', () => {
    const root = join(__dirname, '../../..');
    const fe = readFileSync(join(root, 'frontend/src/pages/admin/ThemeEditor/ai/ai-blueprint.schema.ts'), 'utf8');
    const nest = readFileSync(join(root, 'nestjs-backend/src/ai/ai-blueprint.schema.ts'), 'utf8');
    for (const type of shared.componentTypes) {
      assert.match(fe, new RegExp(`'${type}'`));
      assert.match(nest, new RegExp(`'${type}'`));
    }
  });
});

describe('validator', () => {
  it('accepts a valid blueprint', () => {
    const bp = validateAiSectionBlueprint(JSON.stringify({
      name: 'Hero',
      schema: { heading: { type: 'text', label: 'Heading', default: 'Hi' } },
      defaultSettings: { heading: 'Hi' },
      layout: { type: 'container', children: [{ type: 'heading', props: { content: '{{settings.heading}}' } }] },
    }));
    assert.equal(bp.name, 'Hero');
  });

  it('rejects unknown primitives', () => {
    assert.throws(() => validateAiSectionBlueprint(JSON.stringify({
      name: 'Bad',
      schema: {},
      defaultSettings: {},
      layout: { type: 'widget_xyz' },
    })), AiSectionValidationError);
  });

  it('rejects script injection', () => {
    assert.throws(() => validateAiSectionBlueprint(JSON.stringify({
      name: 'X',
      schema: { heading: { type: 'text', label: 'H', default: '<script>alert(1)</script>' } },
      defaultSettings: { heading: '<script>alert(1)</script>' },
      layout: { type: 'container' },
    })), /unsafe/i);
  });

  it('rejects javascript urls', () => {
    assert.throws(() => validateAiSectionBlueprint(JSON.stringify({
      name: 'X',
      schema: { button_link: { type: 'link', label: 'L', default: 'javascript:alert(1)' } },
      defaultSettings: { button_link: 'javascript:alert(1)' },
      layout: { type: 'container', children: [{ type: 'button', props: { link: 'javascript:alert(1)' } }] },
    })), AiSectionValidationError);
  });
});

describe('planner capabilities', () => {
  it('plans tab collections, recommend ATC, before/after labels, and quantity', () => {
    const tabs = planSectionLayout('tabbed collections with four tabs each showing a collection grid');
    assert.ok(tabs.components.includes('tabs'));
    assert.ok(tabs.constraints.some((c) => /tab_N_collection_id/.test(c)));

    const rec = planSectionLayout('recommended products in a grid with rating and add to cart');
    assert.ok(rec.components.includes('recommend'));
    assert.ok(rec.constraints.some((c) => /Add to Cart/.test(c)));
    assert.ok(rec.constraints.some((c) => /recommend_layout/.test(c)));

    const ba = planSectionLayout('before and after slider with labels');
    assert.ok(ba.components.includes('before_after'));
    assert.ok(ba.constraints.some((c) => /before_label/.test(c)));

    const qty = planSectionLayout('product cards with quantity selector and add to cart');
    assert.ok(qty.components.includes('product'));
    assert.ok(qty.constraints.some((c) => /quantity/.test(c)));

    const icons = planSectionLayout('feature icons with individual card backgrounds');
    assert.ok(icons.components.includes('icon'));
    assert.ok(icons.constraints.some((c) => /icon_N_bg/.test(c)));
  });
});

describe('planner', () => {
  it('plans a product grid from an explicit product prompt', () => {
    const plan = planSectionLayout('3-column product section with prices');
    assert.ok(plan.components.includes('product'));
  });

  it('does not treat reviews as a product grid', () => {
    const plan = planSectionLayout('customer reviews with rating summary');
    assert.ok(plan.components.includes('reviews'));
    assert.equal(plan.components.includes('product'), false);
  });

  it('plans FAQ as accordion', () => {
    const plan = planSectionLayout('FAQ accordion with questions and answers');
    assert.ok(plan.components.includes('accordion'));
  });

  it('plans specifications as specs', () => {
    const plan = planSectionLayout('product specifications section');
    assert.ok(plan.components.includes('specs'));
  });
});

describe('UCSE compose contract', () => {
  const style = () => planSectionStyle('navy gold serif');
  const run = (prompt: string) => {
    const plan = planSectionLayout(prompt);
    assert.equal(shouldCompose(prompt, plan), true, prompt);
    const bp = composeBlueprint(prompt, plan, style());
    return validateAiSectionBlueprint(JSON.stringify(bp));
  };
  const types = (bp: any) => JSON.stringify(bp.layout);

  it('1 bento six independent cells', () => {
    const bp = run('Create a bento section with six independently styled cells, different sizes, images, headings, descriptions, buttons');
    assert.equal((types(bp).match(/"type":"bento_cell"/g) || []).length, 6);
    assert.ok(bp.layout.id);
  });
  it('2 three independent tabs', () => {
    const bp = run('Create a tabs section with three tabs, each with an independent collection and independent styling.');
    assert.equal((types(bp).match(/"type":"tab"/g) || []).length, 3);
    assert.ok(bp.schema.tab_1_collection_id);
    assert.ok(bp.schema.tab_3_collection_id);
  });
  it('3 video commerce with products', () => {
    const bp = run('Create a video commerce section with video, poster, overlay, heading, text, multiple buttons, and a live product carousel below the video.');
    assert.ok(types(bp).includes('video'));
    assert.ok(types(bp).includes('product'));
    assert.ok(bp.schema.poster);
  });
  it('4 three independent before/after blocks', () => {
    const bp = run('Create three independent before/after blocks, each with different images, labels, heading, description, CTA');
    assert.equal((types(bp).match(/"type":"before_after"/g) || []).length, 3);
  });
  it('5 sticky story items', () => {
    const bp = run('Create a sticky story section with three independent story items, each with image, heading, description, caption, button');
    assert.ok(types(bp).includes('sticky_split'));
  });
  it('6 four product comparison', () => {
    const bp = run('Create a product comparison section with four live product columns, each with product picker, image, name, price, rating, quantity, add to cart, buy now');
    assert.ok(bp.schema.product_4);
    assert.ok(types(bp).includes('comparison_table'));
  });
  it('7 responsive grid to carousel', () => {
    const bp = run('Create a grid section that is desktop 4-column grid, tablet 2-column grid, mobile single-column carousel with mobile-only horizontal scrolling');
    assert.equal(bp.defaultSettings.columns, '4');
    assert.equal(bp.defaultSettings.tablet_columns, '2');
    assert.equal(bp.defaultSettings.mobile_layout, 'carousel');
  });
  it('8 complex luxury composition', () => {
    const bp = run('Create a luxury commerce section containing hero, buttons, feature cards, product carousel, collection grid, testimonials, and FAQ');
    const t = types(bp);
    assert.ok(t.includes('icon') || t.includes('grid'));
    assert.ok(t.includes('testimonial'));
    assert.ok(t.includes('accordion'));
  });
  it('9 four independently styled cards', () => {
    const bp = run('Create a section with four cards, each containing heading, text, button, and image');
    assert.ok((types(bp).match(/"type":"heading"/g) || []).length >= 4);
  });
  it('10 deeply nested sticky composition', () => {
    const bp = run('Create a deeply nested section with split layout containing sticky image on one side and scrolling stack on the other. The stack contains heading, rich text, product carousel, accordion, and before/after block');
    const t = types(bp);
    assert.ok(t.includes('sticky_split'));
    assert.ok(t.includes('accordion'));
    assert.ok(t.includes('before_after') || t.includes('product'));
  });
});

describe('universal compose', () => {
  it('composes bento, tabs, compare, sticky, video commerce, and multi before-after', () => {
    const style = planSectionStyle('navy gold serif');
    const bento = composeBlueprint('six-cell luxury bento layout', planSectionLayout('six-cell luxury bento layout'), style);
    assert.ok(JSON.stringify(bento.layout).includes('bento_cell'));
    const tabs = composeBlueprint('three tabs with a different live collection inside each tab', planSectionLayout('three tabs with collection'), style);
    assert.equal((JSON.stringify(tabs.layout).match(/"type":"tab"/g) || []).length, 3);
    const ba = composeBlueprint('three independent before-and-after comparison blocks', planSectionLayout('three independent before and after blocks'), style);
    assert.equal((JSON.stringify(ba.layout).match(/"type":"before_after"/g) || []).length, 3);
    const sticky = composeBlueprint('four independent story items beside a sticky image', planSectionLayout('sticky image with four story items'), style);
    assert.ok(JSON.stringify(sticky.layout).includes('sticky_split'));
    const video = composeBlueprint('video commerce with overlay, two buttons, and live product carousel', planSectionLayout('video overlay products carousel'), style);
    assert.ok(JSON.stringify(video.layout).includes('video'));
    assert.ok(JSON.stringify(video.layout).includes('product'));
    const cmp = composeBlueprint('four-product live comparison', planSectionLayout('compare four products'), style);
    assert.ok(cmp.schema.product_4);
    const cards = composeBlueprint('six collection cards 3 columns desktop 2 columns tablet carousel on mobile', planSectionLayout('six collection cards carousel on mobile'), style);
    assert.equal(cards.defaultSettings.mobile_layout, 'carousel');
    assert.equal(shouldCompose('one live product and a 2x2 collection grid', planSectionLayout('one live product and a 2x2 collection grid')), true);
  });
});

describe('repeating rows composer', () => {
  it('plans and synthesizes four independent story rows', () => {
    const prompt = 'Create four story rows with independent images, captions, headings, descriptions, and buttons. Alternate the image placement independently for each row.';
    assert.equal(isRepeatingRowsPrompt(prompt), true);
    assert.equal(isSimpleBannerPrompt(prompt), false);
    const plan = planSectionLayout(prompt);
    assert.ok(plan.suggestedTree.includes('row x4'));
    const bp = synthesizeRepeatingRowsBlueprint(prompt, planSectionStyle(prompt));
    const validated = validateAiSectionBlueprint(JSON.stringify(bp));
    const rows = JSON.stringify(validated.layout).match(/"type":"row"/g) || [];
    assert.equal(rows.length, 4);
    assert.ok(validated.defaultSettings.heading_1);
    assert.ok(validated.defaultSettings.heading_4);
    assert.equal(validated.defaultSettings.row_1_position, 'left');
    assert.equal(validated.defaultSettings.row_2_position, 'right');
  });
});

describe('simple banner synthesizer', () => {
  it('accepts mixed select options and synthesizes a banner', () => {
    const prompt = 'Create a simple collection banner with a heading, short description, collection image, and Shop Now button';
    assert.equal(isSimpleBannerPrompt(prompt), true);
    const bp = synthesizeSimpleBannerBlueprint(prompt, planSectionStyle(prompt));
    const validated = validateAiSectionBlueprint(JSON.stringify(bp));
    assert.ok(JSON.stringify(validated.layout).includes('image'));
    const mixed = validateAiSectionBlueprint(JSON.stringify({
      name: 'Banner',
      schema: {
        text_align: {
          type: 'select',
          label: 'Align',
          default: 'left',
          options: [{ label: 'Left', value: 'left' }, 'center', { value: 'right' }],
        },
      },
      defaultSettings: { text_align: 'left' },
      layout: { type: 'container', children: [{ type: 'heading' }] },
    }));
    assert.ok(mixed.schema.text_align);
  });
});

describe('faq synthesizer', () => {
  it('normalizes array faq_items and synthesizes a valid FAQ', () => {
    assert.equal(isFaqPrompt('modern FAQ section with 4 expandable questions'), true);
    assert.equal(planSectionStyle('green background FAQ').settings.bg_color, '#16a34a');
    const bp = synthesizeFaqBlueprint('FAQ accordion', planSectionStyle('light beige background dark heading'));
    const validated = validateAiSectionBlueprint(JSON.stringify(bp));
    assert.ok(JSON.stringify(validated.layout).includes('accordion'));
    const recovered = validateAiSectionBlueprint(JSON.stringify({
      name: 'FAQ',
      schema: { faq_items: { type: 'array', label: 'FAQs', default: [{ q: 'Q1', a: 'A1' }] } },
      defaultSettings: { faq_items: [{ q: 'Q1', a: 'A1' }] },
      layout: { type: 'container', children: [{ type: 'accordion', children: [{ type: 'accordion_item' }] }] },
    }));
    assert.equal(recovered.defaultSettings.faq_1_q, 'Q1');
    assert.equal(recovered.schema.faq_items, undefined);
  });
});

describe('luxury combo synthesizer', () => {
  it('matches the kitchen-sink jewelry prompt and emits valid JSON', () => {
    const prompt = 'Create a luxury jewelry section with collection cards, live products, feature icons, before-and-after imagery, multiple CTAs, ratings, quantity controls, gold/navy/burgundy colors, per-card styling, button hover effects, and responsive desktop, tablet, and mobile layouts';
    assert.equal(isLuxuryComboPrompt(prompt), true);
    const bp = synthesizeLuxuryComboBlueprint(prompt, planSectionStyle(prompt));
    const validated = validateAiSectionBlueprint(JSON.stringify(bp));
    assert.equal(validated.layout.type, 'container');
    assert.ok(JSON.stringify(validated.layout).includes('collection'));
    assert.ok(JSON.stringify(validated.layout).includes('product'));
    assert.ok(JSON.stringify(validated.layout).includes('before_after'));
  });
});

describe('resource refs', () => {
  it('collects product and collection keys', () => {
    const refs = collectResourceRefs({ product_1: '12', collection_id: '4', tab_2_collection_id: '9', collection_3: '11', heading: 'Hi' });
    assert.deepEqual(refs.products, ['12']);
    assert.deepEqual(refs.collections.sort(), ['11', '4', '9']);
  });
});
