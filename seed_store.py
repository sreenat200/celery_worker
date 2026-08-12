"""
Default store seed: 4 collections + 4 products with optimized WebP images on R2.
Triggered after a new store is created. Fully store-scoped and idempotent.
"""
from __future__ import annotations

import json
import logging
import urllib.request
from datetime import datetime
from io import BytesIO

from PIL import Image
from celery_app import app
from tasks import get_db_connection, get_r2_client, public_or_asset_url

logger = logging.getLogger(__name__)

SEED_MARKER = "platform_seed_v1"

SEED_COLLECTIONS = [
    {
        "key": "new-arrivals",
        "name": "New Arrivals",
        "description": "Fresh drops and the latest additions to the store.",
        "display_order": 1,
    },
    {
        "key": "bestsellers",
        "name": "Best Sellers",
        "description": "Customer favorites and top-performing products.",
        "display_order": 2,
    },
    {
        "key": "essentials",
        "name": "Essentials",
        "description": "Everyday staples designed for lasting quality.",
        "display_order": 3,
    },
    {
        "key": "sale",
        "name": "Sale",
        "description": "Limited-time offers and special pricing.",
        "display_order": 4,
    },
]

# Predefined seed product images (downloaded once, optimized to WebP, originals discarded)
SEED_PRODUCTS = [
    {
        "key": "classic-tee",
        "name": "Classic Cotton Tee",
        "description": "Soft midweight cotton tee with a clean everyday fit. Perfect for layering or wearing on its own.",
        "short_description": "Soft cotton everyday tee",
        "price": 29.99,
        "mrp": 39.99,
        "sku_suffix": "P01",
        "category": "Apparel",
        "stock": 50,
        "collection_keys": ["new-arrivals", "essentials"],
        "is_featured": True,
        "image_url": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80",
    },
    {
        "key": "everyday-tote",
        "name": "Everyday Canvas Tote",
        "description": "Durable canvas tote with reinforced handles. Spacious enough for work, travel, or weekend errands.",
        "short_description": "Durable canvas tote bag",
        "price": 24.5,
        "mrp": 32.0,
        "sku_suffix": "P02",
        "category": "Accessories",
        "stock": 40,
        "collection_keys": ["bestsellers", "essentials"],
        "is_featured": True,
        "image_url": "https://images.unsplash.com/photo-1590874103328-eac38a67478a?auto=format&fit=crop&w=1200&q=80",
    },
    {
        "key": "ceramic-mug",
        "name": "Matte Ceramic Mug",
        "description": "Minimal matte ceramic mug with a comfortable handle. Microwave and dishwasher safe.",
        "short_description": "Minimal matte ceramic mug",
        "price": 18.0,
        "mrp": 22.0,
        "sku_suffix": "P03",
        "category": "Home",
        "stock": 75,
        "collection_keys": ["bestsellers", "new-arrivals"],
        "is_featured": False,
        "image_url": "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=1200&q=80",
    },
    {
        "key": "linen-scarf",
        "name": "Lightweight Linen Scarf",
        "description": "Breathable linen scarf with a soft hand feel. An easy layer for transitional weather.",
        "short_description": "Soft lightweight linen scarf",
        "price": 34.0,
        "mrp": 45.0,
        "sku_suffix": "P04",
        "category": "Accessories",
        "stock": 30,
        "collection_keys": ["sale", "new-arrivals"],
        "is_featured": False,
        "image_url": "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=1200&q=80",
    },
]


def _download_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "SimpleMeeshoSeed/1.0"})
    with urllib.request.urlopen(req, timeout=45) as resp:
        return resp.read()


def _optimize_seed_image_impl(source_url: str, max_size=(1600, 1600), quality=85):
    """Download a seed image and return optimized WebP bytes (original not kept)."""
    try:
        raw = _download_bytes(source_url)
    except Exception:
        # Fallback placeholder if remote host fails
        fallback = f"https://picsum.photos/seed/{abs(hash(source_url)) % 10000}/1200/1200.webp"
        raw = _download_bytes(fallback)
    with Image.open(BytesIO(raw)) as img:
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        img.thumbnail(max_size)
        out = BytesIO()
        img.save(out, format="WEBP", optimize=True, quality=quality)
        out.seek(0)
        thumb = img.copy()
        thumb.thumbnail((400, 400))
        tbuf = BytesIO()
        thumb.save(tbuf, format="WEBP", optimize=True, quality=80)
        tbuf.seek(0)
        return {
            "optimized": out.getvalue(),
            "thumbnail": tbuf.getvalue(),
            "width": img.size[0],
            "height": img.size[1],
        }


def _upload_seed_image_to_r2_impl(store_id: int, product_id: int, webp_bytes: bytes, content_type="image/webp"):
    """Upload only the optimized WebP to R2. Returns object key + r2 URI."""
    bucket = os_environ_bucket()
    r2 = get_r2_client()
    key = f"stores/{store_id}/products/{product_id}/image.webp"
    r2.upload_fileobj(
        BytesIO(webp_bytes),
        bucket,
        key,
        ExtraArgs={"ContentType": content_type},
    )
    return {"key": key, "r2_uri": f"r2://{bucket}/{key}", "bucket": bucket}


@app.task(
    name="media_worker.tasks.optimize_seed_image",
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=3,
)
def optimize_seed_image(source_url: str, max_size=(1600, 1600), quality=85):
    return _optimize_seed_image_impl(source_url, max_size=max_size, quality=quality)


@app.task(
    name="media_worker.tasks.upload_seed_image_to_r2",
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=3,
)
def upload_seed_image_to_r2(store_id: int, product_id: int, webp_bytes: bytes, content_type="image/webp"):
    return _upload_seed_image_to_r2_impl(store_id, product_id, webp_bytes, content_type)


def os_environ_bucket():
    import os
    return os.environ.get("R2_BUCKET_NAME", "simple-meesho-media")


@app.task(
    name="media_worker.tasks.process_seed_product_image",
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=4,
)
def process_seed_product_image(store_id: int, product_id: int, source_url: str, alt_text: str = ""):
    """
    Optimize seed image → upload WebP to R2 → create media_asset → attach to product.
    Does not permanently store the original.
    """
    import os

    logger.info("Processing seed image for store=%s product=%s", store_id, product_id)
    optimized = _optimize_seed_image_impl(source_url)
    uploaded = _upload_seed_image_to_r2_impl(store_id, product_id, optimized["optimized"])

    # Optional thumbnail key alongside main
    bucket = uploaded["bucket"]
    r2 = get_r2_client()
    thumb_key = f"stores/{store_id}/products/{product_id}/thumb.webp"
    r2.upload_fileobj(
        BytesIO(optimized["thumbnail"]),
        bucket,
        thumb_key,
        ExtraArgs={"ContentType": "image/webp"},
    )
    thumb_uri = f"r2://{bucket}/{thumb_key}"

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # Idempotent: reuse media if product already has media_id
        cur.execute(
            "SELECT media_id, image_url FROM product WHERE id = %s AND store_id = %s",
            (product_id, store_id),
        )
        row = cur.fetchone()
        if not row:
            raise ValueError(f"Product {product_id} not found for store {store_id}")
        existing_media_id, existing_url = row
        if existing_media_id:
            logger.info("Product %s already has media_id=%s — skipping recreate", product_id, existing_media_id)
            return {"status": "skipped", "media_id": existing_media_id, "store_id": store_id, "product_id": product_id}

        api_base = (
            os.environ.get("PUBLIC_API_URL")
            or os.environ.get("API_URL")
            or "http://localhost:3000"
        ).rstrip("/")

        cur.execute(
            """
            INSERT INTO media_asset (
              store_id, file_name, mime_type, file_size, width, height,
              r2_object_key, bucket_name, thumbnail_keys, status,
              original_url, thumbnail_url, alt_text, tags, is_common_asset,
              created_at, last_scanned_at
            ) VALUES (
              %s, %s, %s, %s, %s, %s,
              %s, %s, %s::json, %s,
              %s, %s, %s, %s::json, false,
              NOW(), NOW()
            ) RETURNING id
            """,
            (
                store_id,
                f"product-{product_id}.webp",
                "image/webp",
                len(optimized["optimized"]),
                optimized["width"],
                optimized["height"],
                uploaded["r2_uri"],
                bucket,
                json.dumps({"small": thumb_uri}),
                "ready",
                uploaded["r2_uri"],
                thumb_uri,
                alt_text or f"Product {product_id}",
                json.dumps({"seed": True, "marker": SEED_MARKER, "product_id": product_id}),
            ),
        )
        media_id = cur.fetchone()[0]
        durable = public_or_asset_url(uploaded["r2_uri"], media_id)
        if not os.environ.get("R2_PUBLIC_URL"):
            durable = f"{api_base}/api/media/assets/{media_id}/content"

        cur.execute(
            """
            UPDATE media_asset
            SET original_url = %s, thumbnail_url = %s
            WHERE id = %s AND store_id = %s
            """,
            (durable, durable, media_id, store_id),
        )
        cur.execute(
            """
            UPDATE product
            SET media_id = %s, image_url = %s
            WHERE id = %s AND store_id = %s
            """,
            (media_id, durable, product_id, store_id),
        )
        cur.execute(
            """
            INSERT INTO product_image (product_id, image_url, media_id, is_featured, alt_text, display_order)
            VALUES (%s, %s, %s, true, %s, 0)
            """,
            (product_id, durable, media_id, alt_text or ""),
        )
        conn.commit()
        logger.info("Attached media %s to product %s (store %s)", media_id, product_id, store_id)
        return {
            "status": "success",
            "media_id": media_id,
            "store_id": store_id,
            "product_id": product_id,
            "r2_key": uploaded["key"],
            "url": durable,
        }
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


@app.task(
    name="media_worker.tasks.seed_default_store_data",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=180,
    max_retries=5,
)
def seed_default_store_data(self, store_id: int):
    """
    Create exactly 4 collections and 4 products for a newly created store.
    Image failures are isolated so the seed still completes for catalog rows.
    """
    store_id = int(store_id)
    logger.info("Starting seed_default_store_data for store_id=%s", store_id)

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id FROM store WHERE id = %s", (store_id,))
        if not cur.fetchone():
            raise ValueError(f"Store {store_id} does not exist")

        # Idempotency: seed SKUs already present
        cur.execute(
            "SELECT COUNT(*) FROM product WHERE store_id = %s AND sku LIKE %s",
            (store_id, f"SEED-{store_id}-%"),
        )
        existing_products = cur.fetchone()[0]
        cur.execute(
            "SELECT COUNT(*) FROM collection WHERE store_id = %s AND handle LIKE %s",
            (store_id, f"seed-{store_id}-%"),
        )
        existing_collections = cur.fetchone()[0]

        if existing_products >= 4 and existing_collections >= 4:
            logger.info("Seed already complete for store %s — skipping", store_id)
            return {"status": "skipped", "store_id": store_id, "reason": "already_seeded"}

        collection_ids = {}
        for col in SEED_COLLECTIONS:
            handle = f"seed-{store_id}-{col['key']}"
            cur.execute(
                "SELECT id FROM collection WHERE store_id = %s AND handle = %s",
                (store_id, handle),
            )
            found = cur.fetchone()
            if found:
                collection_ids[col["key"]] = found[0]
                continue

            cur.execute(
                """
                INSERT INTO collection (
                  name, description, handle, collection_type, status, is_active,
                  display_order, store_id, created_at, published_at, sales_channels
                ) VALUES (
                  %s, %s, %s, 'manual', 'active', true,
                  %s, %s, NOW(), NOW(), %s::json
                ) RETURNING id
                """,
                (
                    col["name"],
                    f"{col['description']}\n\n[{SEED_MARKER}]",
                    handle,
                    col["display_order"],
                    store_id,
                    json.dumps(["Online Store"]),
                ),
            )
            collection_ids[col["key"]] = cur.fetchone()[0]
            logger.info("Created collection %s for store %s", col["name"], store_id)

        conn.commit()

        product_rows = []
        for prod in SEED_PRODUCTS:
            sku = f"SEED-{store_id}-{prod['sku_suffix']}"
            slug = f"seed-{store_id}-{prod['key']}"
            cur.execute(
                "SELECT id FROM product WHERE store_id = %s AND sku = %s",
                (store_id, sku),
            )
            found = cur.fetchone()
            if found:
                product_id = found[0]
            else:
                cur.execute(
                    """
                    INSERT INTO product (
                      name, description, short_description, price, mrp, sku, slug,
                      stock, category, is_active, is_featured, status, store_id,
                      stock_status, vendor, product_type, tags, published_at, sales_channels
                    ) VALUES (
                      %s, %s, %s, %s, %s, %s, %s,
                      %s, %s, true, %s, 'Published', %s,
                      'in_stock', 'Demo Brand', %s, %s, NOW(), %s::json
                    ) RETURNING id
                    """,
                    (
                        prod["name"],
                        prod["description"],
                        prod["short_description"],
                        prod["price"],
                        prod["mrp"],
                        sku,
                        slug,
                        prod["stock"],
                        prod["category"],
                        prod["is_featured"],
                        store_id,
                        prod["category"],
                        f"{SEED_MARKER},{prod['key']}",
                        json.dumps(["Online Store"]),
                    ),
                )
                product_id = cur.fetchone()[0]
                logger.info("Created product %s (id=%s) for store %s", prod["name"], product_id, store_id)

            # Link collections (store-scoped)
            for ckey in prod["collection_keys"]:
                cid = collection_ids.get(ckey)
                if not cid:
                    continue
                cur.execute(
                    """
                    INSERT INTO product_collections (product_id, collection_id)
                    VALUES (%s, %s)
                    ON CONFLICT (product_id, collection_id) DO NOTHING
                    """,
                    (product_id, cid),
                )

            product_rows.append({**prod, "id": product_id})

        conn.commit()
    except Exception:
        conn.rollback()
        logger.exception("Catalog seed failed for store %s", store_id)
        raise
    finally:
        cur.close()
        conn.close()

    image_results = []
    for prod in product_rows:
        try:
            result = process_seed_product_image(
                store_id,
                prod["id"],
                prod["image_url"],
                alt_text=prod["name"],
            )
            image_results.append(result)
        except Exception as e:
            logger.exception(
                "Seed image failed for store=%s product=%s: %s",
                store_id,
                prod.get("id"),
                e,
            )
            image_results.append(
                {
                    "status": "failed",
                    "store_id": store_id,
                    "product_id": prod.get("id"),
                    "error": str(e),
                }
            )

    # Attach collection cover images from the first linked product that has media
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        for col_key, col_id in collection_ids.items():
            cur.execute(
                """
                SELECT p.media_id, p.image_url
                FROM product_collections pc
                JOIN product p ON p.id = pc.product_id
                WHERE pc.collection_id = %s
                  AND p.store_id = %s
                  AND p.media_id IS NOT NULL
                ORDER BY p.id ASC
                LIMIT 1
                """,
                (col_id, store_id),
            )
            row = cur.fetchone()
            if not row:
                continue
            media_id, image_url = row
            cur.execute(
                """
                UPDATE collection
                SET media_id = %s, image_url = %s
                WHERE id = %s AND store_id = %s
                  AND (media_id IS NULL OR image_url IS NULL OR image_url = '')
                """,
                (media_id, image_url, col_id, store_id),
            )
            logger.info(
                "Attached collection cover media=%s to collection %s (%s)",
                media_id,
                col_id,
                col_key,
            )
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        logger.exception("Failed attaching collection covers for store %s: %s", store_id, e)

    logger.info("Completed seed_default_store_data for store_id=%s", store_id)
    return {
        "status": "success",
        "store_id": store_id,
        "collections": 4,
        "products": 4,
        "images": image_results,
        "completed_at": datetime.utcnow().isoformat() + "Z",
    }
