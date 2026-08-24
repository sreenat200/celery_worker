import { PrismaService } from '../prisma/prisma.service';

const PRODUCT_KEYS = /^(product_id|product_\d+|pin_\d+_product)$/i;
const COLLECTION_KEYS = /^(collection_id|collectionId|tab_\d+_collection_id|collection_\d+)$/i;
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
    const found = ids.length
      ? await prisma.product.findMany({
          where: { store_id: storeId, id: { in: ids } },
          select: { id: true },
        })
      : [];
    const ok = new Set(found.map((p) => String(p.id)));
    for (const [key, raw] of Object.entries(settings)) {
      if (PRODUCT_KEYS.test(key) && raw && !ok.has(String(raw))) settings[key] = '';
    }
  }
  if (refs.collections.length) {
    const numeric = refs.collections.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0);
    const handles = refs.collections.filter((v) => !Number.isFinite(Number(v)));
    const found =
      numeric.length || handles.length
        ? await prisma.collection.findMany({
            where: {
              store_id: storeId,
              OR: [
                ...(numeric.length ? [{ id: { in: numeric } }] : []),
                ...(handles.length ? [{ handle: { in: handles } }] : []),
              ],
            },
            select: { id: true, handle: true },
          })
        : [];
    const ok = new Set(found.flatMap((c) => [String(c.id), String(c.handle || '')].filter(Boolean)));
    for (const [key, raw] of Object.entries(settings)) {
      if (COLLECTION_KEYS.test(key) && raw && !ok.has(String(raw))) settings[key] = '';
    }
  }
  if (refs.pages.length) {
    const slugs = refs.pages.filter((v) => !/^\d+$/.test(v));
    const ids = refs.pages.filter((v) => /^\d+$/.test(v)).map(Number);
    const found =
      ids.length || slugs.length
        ? await prisma.page.findMany({
            where: {
              store_id: storeId,
              OR: [
                ...(ids.length ? [{ id: { in: ids } }] : []),
                ...(slugs.length ? [{ slug: { in: slugs } }] : []),
              ],
            },
            select: { id: true, slug: true },
          })
        : [];
    const ok = new Set(found.flatMap((p) => [String(p.id), String((p as any).slug || '')].filter(Boolean)));
    for (const [key, raw] of Object.entries(settings)) {
      if (PAGE_KEYS.test(key) && raw && !ok.has(String(raw))) settings[key] = '';
    }
  }
}
