import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AI_COMPONENT_TYPES } from './ai-section-component-registry';
import { validateAiSectionBlueprint, AiSectionValidationError } from './ai-section-validator';
import { planSectionLayout } from './ai-section-layout-planner';
import { collectResourceRefs } from './ai-section-resources';

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

describe('resource refs', () => {
  it('collects product and collection keys', () => {
    const refs = collectResourceRefs({ product_1: '12', collection_id: '4', heading: 'Hi' });
    assert.deepEqual(refs.products, ['12']);
    assert.deepEqual(refs.collections, ['4']);
  });
});
