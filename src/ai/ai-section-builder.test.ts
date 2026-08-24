import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AI_COMPONENT_TYPES } from './ai-section-component-registry';
import { validateAiSectionBlueprint, AiSectionValidationError } from './ai-section-validator';
import { planSectionLayout } from './ai-section-layout-planner';
import { collectResourceRefs } from './ai-section-resources';
import { isFaqPrompt, isLuxuryComboPrompt, synthesizeFaqBlueprint, synthesizeLuxuryComboBlueprint } from './ai-section-synthesize';
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
