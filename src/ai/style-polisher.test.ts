import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSpacing,
  normalizeTypography,
  injectCardStyles,
  injectButtonStyles,
  generateResponsiveStyles,
  polishBlueprint,
} from './style-polisher';
import { DESIGN_TOKENS } from './design-tokens';

describe('style-polisher normalizeSpacing', () => {
  it('rounds padding and gap to the nearest multiple of 8', () => {
    const node = normalizeSpacing({ type: 'grid', style: { desktop: { padding: '47px', gap: '23px' } } }, { type: 'container' });
    assert.equal(node.style.desktop.padding, '48px');
    assert.equal(node.style.desktop.gap, '24px');
  });

  it('defaults root section padding to 64px desktop / 40px mobile', () => {
    const root = normalizeSpacing({ type: 'container', children: [] }, null);
    assert.equal(root.style.desktop.padding, '64px');
    assert.equal(root.style.mobile.padding, '40px');
  });

  it('clamps root section padding to 48-96px desktop', () => {
    const root = normalizeSpacing({ type: 'container', style: { desktop: { padding: '120px' } } }, null);
    assert.equal(root.style.desktop.padding, '96px');
  });
});

describe('style-polisher normalizeTypography', () => {
  it('clamps heading weight to 600 and adds letter-spacing/line-height', () => {
    const node = normalizeTypography({ type: 'heading', style: { desktop: { fontWeight: '800', fontSize: '48px' } } });
    assert.equal(node.style.desktop.fontWeight, '600');
    assert.equal(node.style.desktop.letterSpacing, '-0.02em');
    assert.equal(node.style.desktop.lineHeight, '1.2');
    assert.equal(node.style.desktop.fontSize, '48px');
  });

  it('clamps body font-size to 14-18px', () => {
    const node = normalizeTypography({ type: 'text', style: { desktop: { fontSize: '24px' } } });
    assert.equal(node.style.desktop.fontSize, '18px');
  });
});

describe('style-polisher injectCardStyles', () => {
  it('injects card styles into grid items', () => {
    const node = injectCardStyles({ type: 'container', children: [{ type: 'text' }] }, { type: 'grid' });
    assert.equal(node.style.desktop.borderRadius, DESIGN_TOKENS.border_radius.md);
    assert.equal(node.style.desktop.boxShadow, DESIGN_TOKENS.shadows.md);
    assert.equal(node.style.desktop.padding, DESIGN_TOKENS.spacing.default_card_padding);
    assert.ok(node.style.hover.transform);
  });

  it('does not style the root container as a card', () => {
    const node = injectCardStyles({ type: 'container', children: [{ type: 'heading' }] }, null);
    assert.equal(node.style?.desktop?.borderRadius, undefined);
  });
});

describe('style-polisher injectButtonStyles', () => {
  it('injects min-height, padding, radius, weight, and hover', () => {
    const node = injectButtonStyles({ type: 'button', style: { desktop: { backgroundColor: 'red' } } });
    assert.equal(node.style.desktop.minHeight, '44px');
    assert.equal(node.style.desktop.padding, '12px 28px');
    assert.equal(node.style.desktop.borderRadius, DESIGN_TOKENS.border_radius.md);
    assert.equal(node.style.desktop.fontWeight, '600');
    assert.ok(node.style.hover);
    // existing backgroundColor is preserved
    assert.equal(node.style.desktop.backgroundColor, 'red');
  });
});

describe('style-polisher generateResponsiveStyles', () => {
  it('collapses grids to 1 column on mobile', () => {
    const node = generateResponsiveStyles({
      type: 'grid',
      style: { desktop: { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' } },
    });
    assert.equal(node.style.mobile.gridTemplateColumns, 'minmax(0, 1fr)');
  });

  it('stacks rows to column on mobile', () => {
    const node = generateResponsiveStyles({ type: 'row', style: { desktop: {} } });
    assert.equal(node.style.mobile.flexDirection, 'column');
  });
});

describe('style-polisher polishBlueprint', () => {
  it('polishes a full feature-cards blueprint', () => {
    const bp = {
      name: 'Feature Cards',
      schema: {},
      defaultSettings: {},
      layout: {
        type: 'container',
        children: [
          { type: 'heading', props: { content: 'Features' } },
          {
            type: 'grid',
            style: { desktop: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' } },
            children: [
              { type: 'column', children: [{ type: 'icon', props: { slot: 1 } }, { type: 'heading', props: { content: 'A' } }] },
              { type: 'column', children: [{ type: 'icon', props: { slot: 2 } }, { type: 'heading', props: { content: 'B' } }] },
              { type: 'column', children: [{ type: 'icon', props: { slot: 3 } }, { type: 'heading', props: { content: 'C' } }] },
            ],
          },
        ],
      },
    };

    const polished = polishBlueprint(bp);
    const root = polished.layout;
    assert.equal(root.style.desktop.padding, '64px');

    const grid = root.children[1];
    assert.equal(grid.style.mobile.gridTemplateColumns, 'minmax(0, 1fr)');

    const card = grid.children[0];
    assert.ok(card.style.desktop.borderRadius);
    assert.ok(card.style.desktop.boxShadow);
    assert.ok(card.style.hover);

    const heading = root.children[0];
    assert.equal(heading.style.desktop.fontWeight, '600');
  });
});
