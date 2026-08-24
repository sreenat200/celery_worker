import { PrismaService } from '../prisma/prisma.service';
import { AiSectionValidationError } from './ai-section-validator';

const PRODUCT_KEYS = /^(product_id|product_\d+|pin_\d+_product)$/i;
const COLLECTION_KEYS = /^(collection_id|collectionId)$/i;
const PAGE_KEYS = /^(pageSlug|page_id|page)$/i;

export function collectResourceRefs(settings: Record<string, any>) {
  const products: string[] = [];
  const collections: string[] = [];
  const pages: string[] = [];
  for (const [key, raw] of Object.entries(settings || {})) {
    if (raw == null || raw === '') continue;
    const value = String(raw).trim();
    if (!value) continue;
    if (PRODUCT_KEYS.test(key)) products.push(value);
    else if (COLLECTION_KEYS.test(key)) collections.push(value);
    else if (PAGE_KEYS.test(key)) pages.push(value);
  }
  return {
    products: Array.from(new Set(products)),
    collections: Array.from(new Set(collections)),
    pages: Array.from(new Set(pages)),
  };
}

export async function validateStoreResources(
  prisma: PrismaService,
  storeId: number,
  settings: Record<string, any>,
) {
  const refs = collectResourceRefs(settings);
  if (refs.products.length) {
    const ids = refs.products.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0);
    if (ids.length !== refs.products.length) {
      throw new AiSectionValidationError('Invalid product reference', 'INVALID_RESOURCE', refs.products);
    }
    const found = await prisma.product.findMany({
      where: { store_id: storeId, id: { in: ids } },
      select: { id: true },
    });
    if (found.length !== ids.length) {
      throw new AiSectionValidationError('Product does not belong to this store', 'CROSS_STORE_RESOURCE');
    }
  }
  if (refs.collections.length) {
    const numeric = refs.collections.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0);
    const handles = refs.collections.filter((v) => !Number.isFinite(Number(v)));
    const found = await prisma.collection.findMany({
      where: {
        store_id: storeId,
        OR: [
          ...(numeric.length ? [{ id: { in: numeric } }] : []),
          ...(handles.length ? [{ handle: { in: handles } }] : []),
        ],
      },
      select: { id: true, handle: true },
    });
    if (found.length < refs.collections.length) {
      throw new AiSectionValidationError('Collection does not belong to this store', 'CROSS_STORE_RESOURCE');
    }
  }
  if (refs.pages.length) {
    const slugs = refs.pages.filter((v) => !/^\d+$/.test(v));
    const ids = refs.pages.filter((v) => /^\d+$/.test(v)).map(Number);
    const found = await prisma.page.findMany({
      where: {
        store_id: storeId,
        OR: [
          ...(ids.length ? [{ id: { in: ids } }] : []),
          ...(slugs.length ? [{ slug: { in: slugs } }] : []),
        ],
      },
      select: { id: true },
    });
    if (found.length < refs.pages.length) {
      throw new AiSectionValidationError('Page does not belong to this store', 'CROSS_STORE_RESOURCE');
    }
  }
}
