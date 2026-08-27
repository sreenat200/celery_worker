import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateAiSectionBlueprint } from './ai-section-validator';
import { polishBlueprint } from './style-polisher';

/**
 * Integration test: AI generation (simulated) → validation → Style Polisher.
 * Verifies the final blueprint meets Shopify-quality baseline criteria.
 */
describe('full pipeline — feature section with 3 cards', () => {
  const raw = JSON.stringify({
    name: 'Feature Section',
    schema: { heading: { type: 'text', label: 'Heading', default: 'Features' } },
    defaultSettings: { heading: 'Features' },
    layout: {
      type: 'container',
      children: [
        { type: 'heading', props: { content: '{{settings.heading}}' } },
        {
          type: 'grid',
          children: [
            { type: 'column', children: [{ type: 'icon', props: { slot: 1 } }, { type: 'heading', props: { content: 'Fast' } }, { type: 'text', props: { content: 'Blazing fast.' } }] },
            { type: 'column', children: [{ type: 'icon', props: { slot: 2 } }, { type: 'heading', props: { content: 'Secure' } }, { type: 'text', props: { content: 'Always safe.' } }] },
            { type: 'column', children: [{ type: 'icon', props: { slot: 3 } }, { type: 'heading', props: { content: 'Reliable' } }, { type: 'text', props: { content: 'Always on.' } }] },
          ],
        },
      ],
    },
  });

  const validated = validateAiSectionBlueprint(raw);
  const polished = polishBlueprint(validated);

  const root = polished.layout;
  const heading = root.children[0];
  const grid = root.children[1];
  const cards = grid.children;

  it('has 3 card nodes', () => {
    assert.equal(cards.length, 3);
  });

  it('gives every card rounded corners', () => {
    for (const card of cards) assert.ok(card.style?.desktop?.borderRadius, 'card should have border-radius');
  });

  it('gives every card a subtle shadow', () => {
    for (const card of cards) assert.ok(card.style?.desktop?.boxShadow, 'card should have box-shadow');
  });

  it('sets heading font-weight to 600', () => {
    assert.equal(heading.style.desktop.fontWeight, '600');
  });

  it('generates mobile styles (grid → 1 column)', () => {
    assert.equal(grid.style.mobile.gridTemplateColumns, 'minmax(0, 1fr)');
  });

  it('sets section desktop padding to 64px', () => {
    assert.equal(root.style.desktop.padding, '64px');
  });

  it('adds hover state to cards', () => {
    for (const card of cards) assert.ok(card.style?.hover?.transform, 'card should have hover transform');
  });
});
