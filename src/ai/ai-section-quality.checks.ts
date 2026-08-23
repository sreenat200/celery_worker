import { planSectionLayout } from './ai-section-layout-planner';
import { validateAiSectionBlueprint, AiSectionValidationError } from './ai-section-validator';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function runPlannerChecks() {
  const video = planSectionLayout('Create a horizontal video section with text on the right.');
  assert(video.mediaType === 'video', 'video plan must request video');
  assert(video.mediaSide === 'left', 'text on the right means video on the left');
  assert(video.layoutDirection === 'split', 'video+text should be a split row');
  assert(video.components.includes('video'), 'video component required');
  assert(video.components.includes('row'), 'row required for horizontal layout');
  assert(!video.scrolling, 'video+text is not a carousel');

  const products = planSectionLayout(
    'Create a 3-column product section with images, prices and Add to Cart buttons.',
  );
  assert(products.layoutDirection === 'grid', 'product columns should use grid');
  assert(products.columns === 3, 'desktop should be 3 columns');
  assert(products.components.includes('product'), 'product component required');
  assert(products.showAddToCart, 'Add to Cart must be planned');
  assert(!products.components.includes('carousel'), 'product grid is not a carousel');

  const collections = planSectionLayout('Create a horizontally scrolling collection section.');
  assert(collections.layoutDirection === 'carousel', 'scrolling collection must use carousel');
  assert(collections.components.includes('collection'), 'collection component required');
  assert(collections.scrolling, 'scrolling flag required');

  const imageRight = planSectionLayout('Create an image and text section with the image on the right.');
  assert(imageRight.mediaType === 'image', 'image-with-text must use image');
  assert(imageRight.mediaSide === 'right', 'image must be on the right');
  assert(imageRight.layoutDirection === 'split', 'image-with-text should be split');

  const banner = planSectionLayout('Create a promotional banner with heading, description and CTA.');
  assert(banner.includeHeading && banner.includeText && banner.includeButton, 'banner needs heading/text/CTA');
  assert(banner.layoutDirection === 'banner' || banner.layoutDirection === 'vertical', 'banner is stacked');

  const stacked = planSectionLayout('Create a mobile-first stacked content section.');
  assert(stacked.layoutDirection === 'stacked', 'stacked request must stay stacked');
}

function runValidatorChecks() {
  const valid = validateAiSectionBlueprint(JSON.stringify({
    name: 'Video With Text',
    schema: {
      heading: { type: 'text', label: 'Heading', default: 'Watch' },
      video: { type: 'video', label: 'Video', default: '' },
    },
    defaultSettings: { heading: 'Watch', video: '' },
    layout: {
      type: 'container',
      children: [
        {
          type: 'row',
          children: [
            { type: 'video', props: { src: '{{settings.video}}' } },
            { type: 'column', children: [{ type: 'heading', props: { content: '{{settings.heading}}', variant: 'h2' } }] },
          ],
        },
      ],
    },
  }));
  assert(valid.layout.type === 'container', 'valid blueprint root is container');
  assert(valid.layout.children[0].type === 'row', 'row preserved');
  assert(valid.layout.children[0].children[0].type === 'video', 'video preserved');

  let rejected = false;
  try {
    validateAiSectionBlueprint(JSON.stringify({
      name: 'Bad',
      schema: {},
      defaultSettings: {},
      layout: { type: 'magicWidget', children: [] },
    }));
  } catch (err) {
    rejected = err instanceof AiSectionValidationError;
  }
  assert(rejected, 'unsupported components must be rejected');

  rejected = false;
  try {
    validateAiSectionBlueprint(JSON.stringify({
      name: 'Unsafe',
      schema: { heading: { type: 'text', label: 'H', default: '<script>alert(1)</script>' } },
      defaultSettings: { heading: '<script>alert(1)</script>' },
      layout: { type: 'heading', props: { content: '{{settings.heading}}' } },
    }));
  } catch (err) {
    rejected = err instanceof AiSectionValidationError && err.code === 'UNSAFE_CONTENT';
  }
  assert(rejected, 'script content must be rejected');
}

export function runAiSectionQualityChecks() {
  runPlannerChecks();
  runValidatorChecks();
  return { ok: true, cases: 8 };
}

if (require.main === module) {
  const result = runAiSectionQualityChecks();
  process.stdout.write(`AI section quality checks passed (${result.cases} cases)\n`);
}
