import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { durableContentUrl, publicOrAssetUrl } from './media-status';
import { encodeWebp, readImageMeta } from './sharp-limits';

const logger = new Logger('SeedStore');
const SEED_MARKER = 'platform_seed_v1';

const SEED_COLLECTIONS = [
  { key: 'new-arrivals', name: 'New Arrivals', description: 'Fresh drops and the latest additions to the store.', display_order: 1 },
  { key: 'bestsellers', name: 'Best Sellers', description: 'Customer favorites and top-performing products.', display_order: 2 },
  { key: 'essentials', name: 'Essentials', description: 'Everyday staples designed for lasting quality.', display_order: 3 },
  { key: 'sale', name: 'Sale', description: 'Limited-time offers and special pricing.', display_order: 4 },
];

const SEED_PRODUCTS = [
  {
    key: 'classic-tee',
    name: 'Classic Cotton Tee',
    description: 'Soft midweight cotton tee with a clean everyday fit. Perfect for layering or wearing on its own.',
    short_description: 'Soft cotton everyday tee',
    price: 29.99,
    mrp: 39.99,
    sku_suffix: 'P01',
    category: 'Apparel',
    stock: 50,
    collection_keys: ['new-arrivals', 'essentials'],
    is_featured: true,
    image_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80',
  },
  {
    key: 'everyday-tote',
    name: 'Everyday Canvas Tote',
    description: 'Durable canvas tote with reinforced handles. Spacious enough for work, travel, or weekend errands.',
    short_description: 'Durable canvas tote bag',
    price: 24.5,
    mrp: 32.0,
    sku_suffix: 'P02',
    category: 'Accessories',
    stock: 40,
    collection_keys: ['bestsellers', 'essentials'],
    is_featured: true,
    image_url: 'https://images.unsplash.com/photo-1590874103328-eac38a67478a?auto=format&fit=crop&w=1200&q=80',
  },
  {
    key: 'ceramic-mug',
    name: 'Matte Ceramic Mug',
    description: 'Minimal matte ceramic mug with a comfortable handle. Microwave and dishwasher safe.',
    short_description: 'Minimal matte ceramic mug',
    price: 18.0,
    mrp: 22.0,
    sku_suffix: 'P03',
    category: 'Home',
    stock: 75,
    collection_keys: ['bestsellers', 'new-arrivals'],
    is_featured: false,
    image_url: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=1200&q=80',
  },
  {
    key: 'linen-scarf',
    name: 'Lightweight Linen Scarf',
    description: 'Breathable linen scarf with a soft hand feel. An easy layer for transitional weather.',
    short_description: 'Soft lightweight linen scarf',
    price: 34.0,
    mrp: 45.0,
    sku_suffix: 'P04',
    category: 'Accessories',
    stock: 30,
    collection_keys: ['sale', 'new-arrivals'],
    is_featured: false,
    image_url: 'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=1200&q=80',
  },
];

async function downloadBytes(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { 'User-Agent': 'SimpleMeeshoSeed/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function optimizeSeedImage(sourceUrl: string) {
  let raw: Buffer;
  try {
    raw = await downloadBytes(sourceUrl);
  } catch {
    const fallback = `https://picsum.photos/seed/${Math.abs(hashCode(sourceUrl)) % 10000}/1200/1200.webp`;
    raw = await downloadBytes(fallback);
  }
  const meta = await readImageMeta(raw);
  const optimized = await encodeWebp(raw, { w: 1600, h: 1600 }, 80);
  const thumbnail = await encodeWebp(optimized, { w: 400, h: 400 }, 75);
  return {
    optimized,
    thumbnail,
    width: meta.width || 0,
    height: meta.height || 0,
  };
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

async function attachSeedImage(
  prisma: PrismaService,
  storage: StorageService,
  storeId: number,
  productId: number,
  sourceUrl: string,
  altText: string,
) {
  const product = await prisma.product.findFirst({
    where: { id: productId, store_id: storeId },
    select: { media_id: true },
  });
  if (!product) throw new Error(`Product ${productId} not found for store ${storeId}`);
  if (product.media_id) {
    return { status: 'skipped', media_id: product.media_id, store_id: storeId, product_id: productId };
  }

  const optimized = await optimizeSeedImage(sourceUrl);
  const key = `stores/${storeId}/products/${productId}/image.webp`;
  const thumbKey = `stores/${storeId}/products/${productId}/thumb.webp`;
  await storage.uploadFile(optimized.optimized, key, 'image/webp');
  await storage.uploadFile(optimized.thumbnail, thumbKey, 'image/webp');
  const r2Uri = storage.toR2Uri(key);
  const thumbUri = storage.toR2Uri(thumbKey);

  const media = await prisma.media_asset.create({
    data: {
      store_id: storeId,
      file_name: `product-${productId}.webp`,
      mime_type: 'image/webp',
      file_size: optimized.optimized.length,
      width: optimized.width,
      height: optimized.height,
      r2_object_key: r2Uri,
      bucket_name: storage.getBucketName(),
      thumbnail_keys: { small: thumbUri },
      status: 'ready',
      original_url: r2Uri,
      thumbnail_url: thumbUri,
      alt_text: altText || `Product ${productId}`,
      tags: { seed: true, marker: SEED_MARKER, product_id: productId },
      is_common_asset: false,
      created_at: new Date(),
      last_scanned_at: new Date(),
    },
  });

  const durable = process.env.R2_PUBLIC_URL
    ? publicOrAssetUrl(r2Uri, media.id)
    : durableContentUrl(media.id);

  await prisma.media_asset.update({
    where: { id: media.id },
    data: { original_url: durable, thumbnail_url: durable },
  });
  await prisma.product.updateMany({
    where: { id: productId, store_id: storeId },
    data: { media_id: media.id, image_url: durable },
  });
  await prisma.product_image.create({
    data: {
      product_id: productId,
      image_url: durable,
      media_id: media.id,
      is_featured: true,
      alt_text: altText || '',
      display_order: 0,
    },
  });
  return {
    status: 'success',
    media_id: media.id,
    store_id: storeId,
    product_id: productId,
    r2_key: key,
    url: durable,
  };
}

export async function seedDefaultStoreData(prisma: PrismaService, storage: StorageService, storeId: number) {
  storeId = Number(storeId);
  logger.log(`Starting seed_default_store_data for store_id=${storeId}`);

  const store = await prisma.store.findFirst({ where: { id: storeId }, select: { id: true } });
  if (!store) throw new Error(`Store ${storeId} does not exist`);

  const existingProducts = await prisma.product.count({
    where: { store_id: storeId, sku: { startsWith: `SEED-${storeId}-` } },
  });
  const existingCollections = await prisma.collection.count({
    where: { store_id: storeId, handle: { startsWith: `seed-${storeId}-` } },
  });
  if (existingProducts >= 4 && existingCollections >= 4) {
    logger.log(`Seed already complete for store ${storeId} — skipping`);
    return { status: 'skipped', store_id: storeId, reason: 'already_seeded' };
  }

  const collectionIds: Record<string, number> = {};
  for (const col of SEED_COLLECTIONS) {
    const handle = `seed-${storeId}-${col.key}`;
    const found = await prisma.collection.findFirst({
      where: { store_id: storeId, handle },
      select: { id: true },
    });
    if (found) {
      collectionIds[col.key] = found.id;
      continue;
    }
    const created = await prisma.collection.create({
      data: {
        name: col.name,
        description: `${col.description}\n\n[${SEED_MARKER}]`,
        handle,
        collection_type: 'manual',
        status: 'active',
        is_active: true,
        display_order: col.display_order,
        store_id: storeId,
        created_at: new Date(),
        published_at: new Date(),
        sales_channels: ['Online Store'],
      },
    });
    collectionIds[col.key] = created.id;
  }

  const productRows: Array<(typeof SEED_PRODUCTS)[number] & { id: number }> = [];
  for (const prod of SEED_PRODUCTS) {
    const sku = `SEED-${storeId}-${prod.sku_suffix}`;
    const slug = `seed-${storeId}-${prod.key}`;
    const found = await prisma.product.findFirst({
      where: { store_id: storeId, sku },
      select: { id: true },
    });
    let productId = found?.id;
    if (!productId) {
      const created = await prisma.product.create({
        data: {
          name: prod.name,
          description: prod.description,
          short_description: prod.short_description,
          price: prod.price,
          mrp: prod.mrp,
          sku,
          slug,
          stock: prod.stock,
          category: prod.category,
          is_active: true,
          is_featured: prod.is_featured,
          status: 'Published',
          store_id: storeId,
          stock_status: 'in_stock',
          vendor: 'Demo Brand',
          product_type: prod.category,
          tags: `${SEED_MARKER},${prod.key}`,
          published_at: new Date(),
          sales_channels: ['Online Store'],
        },
      });
      productId = created.id;
    }
    for (const ckey of prod.collection_keys) {
      const cid = collectionIds[ckey];
      if (!cid) continue;
      const existingLink = await prisma.product_collections.findUnique({
        where: { product_id_collection_id: { product_id: productId, collection_id: cid } },
      });
      if (!existingLink) {
        await prisma.product_collections.create({
          data: { product_id: productId, collection_id: cid },
        });
      }
    }
    productRows.push({ ...prod, id: productId });
  }

  const imageResults: any[] = [];
  for (const prod of productRows) {
    try {
      imageResults.push(await attachSeedImage(prisma, storage, storeId, prod.id, prod.image_url, prod.name));
    } catch (e) {
      logger.error(`Seed image failed store=${storeId} product=${prod.id}: ${(e as Error).message}`);
      imageResults.push({
        status: 'failed',
        store_id: storeId,
        product_id: prod.id,
        error: (e as Error).message,
      });
    }
  }

  for (const [colKey, colId] of Object.entries(collectionIds)) {
    const link = await prisma.product_collections.findFirst({
      where: { collection_id: colId, product: { store_id: storeId, media_id: { not: null } } },
      include: { product: { select: { media_id: true, image_url: true } } },
      orderBy: { product_id: 'asc' },
    });
    if (!link?.product?.media_id) continue;
    await prisma.collection.updateMany({
      where: {
        id: colId,
        store_id: storeId,
        OR: [{ media_id: null }, { image_url: null }, { image_url: '' }],
      },
      data: { media_id: link.product.media_id, image_url: link.product.image_url },
    });
    logger.log(`Attached collection cover media=${link.product.media_id} to ${colId} (${colKey})`);
  }

  logger.log(`Completed seed_default_store_data for store_id=${storeId}`);
  return {
    status: 'success',
    store_id: storeId,
    collections: 4,
    products: 4,
    images: imageResults,
    completed_at: new Date().toISOString(),
  };
}
