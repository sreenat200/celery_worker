import os
import json
import logging
import tempfile
import boto3
import psycopg2
import smtplib
from PIL import Image, ImageOps
from io import BytesIO
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from celery_app import app

logger = logging.getLogger(__name__)

# Canonical statuses (aligned with NestJS MediaService)
STATUS_PROCESSING = "processing"
STATUS_READY = "ready"
STATUS_FAILED = "failed"
STATUS_DELETED = "deleted"

ALLOWED_FORMATS = {"JPEG", "JPG", "PNG", "WEBP", "AVIF"}
MAX_DIMENSION = 10000
# Reject decompression bombs: images larger than 40MP raise DecompressionBombError
# (the API's MAX_DIMENSION alone would still allow e.g. a 10000x10000 raster).
Image.MAX_IMAGE_PIXELS = 40_000_000
SIZES = {
    "optimized": None,
    "thumbnail": (200, 200),
    "medium": (800, 800),
    "large": (1600, 1600),
}


@app.task(name='media_worker.tasks.send_otp_email', autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def send_otp_email(to_email, otp, store_id=None):
    smtp_host = os.environ.get("EMAIL_HOST", "smtp.gmail.com")
    smtp_port = int(os.environ.get("EMAIL_PORT", 587))
    smtp_user = os.environ.get("EMAIL_HOST_USER", "")
    smtp_pass = os.environ.get("EMAIL_HOST_PASSWORD", "")
    from_email = os.environ.get("DEFAULT_FROM_EMAIL", smtp_user or "no-reply@aetherweb.site")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Your Verification Code"
    msg["From"] = from_email
    msg["To"] = to_email

    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e4e4e7; border-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #18181b; font-size: 20px; font-weight: 700; margin-bottom: 8px; text-align: center;">One-Time Verification Code</h2>
      <p style="color: #71717a; font-size: 14px; text-align: center; margin-bottom: 24px;">Enter the code below to log in to your account. This code expires in 10 minutes.</p>
      <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; text-align: center; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #09090b; margin-bottom: 24px;">
        {otp}
      </div>
      <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin: 0;">If you did not request this code, please ignore this email.</p>
    </div>
    """
    msg.attach(MIMEText(html_content, "html"))

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        if os.environ.get("EMAIL_USE_TLS", "True").lower() in ("true", "1"):
            server.starttls()
        if smtp_user and smtp_pass:
            server.login(smtp_user, smtp_pass)
        server.sendmail(from_email, [to_email], msg.as_string())

    return {"status": "success", "to": to_email, "store_id": store_id}


# Alias for older enqueue names
app.task(name='tasks.send_otp_email', autoretry_for=(Exception,), retry_backoff=True, max_retries=3)(send_otp_email)


def get_db_connection():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise ValueError("DATABASE_URL not set")
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    import urllib.parse
    try:
        parsed = urllib.parse.urlparse(db_url)
        if parsed.query:
            query_params = urllib.parse.parse_qs(parsed.query)
            if 'sslmode' in query_params and query_params['sslmode'][0] not in [
                'disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full'
            ]:
                query_params['sslmode'] = ['require']
                new_query = urllib.parse.urlencode(query_params, doseq=True)
                db_url = urllib.parse.urlunparse(parsed._replace(query=new_query))
    except Exception:
        pass

    if "sslmode=no-verify" in db_url:
        db_url = db_url.replace("sslmode=no-verify", "sslmode=require")

    return psycopg2.connect(db_url)


def get_r2_client():
    account_id = os.environ.get("R2_ACCOUNT_ID", "")
    endpoint = os.environ.get("R2_ENDPOINT_URL") or (
        f"https://{account_id}.r2.cloudflarestorage.com" if account_id else None
    )
    access_key = os.environ.get("R2_ACCESS_KEY_ID", "dummy")
    secret_key = os.environ.get("R2_SECRET_ACCESS_KEY", "dummy")

    return boto3.client(
        service_name='s3',
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name='auto'
    )


def parse_r2_source(source, default_bucket):
    """Resolve r2:// URI, plain object key, or (legacy) local path."""
    if not source or not isinstance(source, str):
        raise ValueError("Invalid media source")

    if source.startswith("r2://"):
        without = source[len("r2://"):]
        bucket, _, key = without.partition("/")
        if not bucket or not key:
            raise ValueError(f"Invalid R2 URI: {source}")
        return ("r2", bucket, key)

    if os.path.exists(source):
        return ("local", None, source)

    return ("r2", default_bucket, source.lstrip("/"))


def load_image_bytes(source, r2, default_bucket):
    mode, bucket, key_or_path = parse_r2_source(source, default_bucket)
    if mode == "local":
        with open(key_or_path, "rb") as f:
            return BytesIO(f.read()), key_or_path, None, None
    buf = BytesIO()
    r2.download_fileobj(bucket, key_or_path, buf)
    buf.seek(0)
    return buf, None, bucket, key_or_path


def public_or_asset_url(r2_uri, asset_id=None, variant=None):
    public_base = (os.environ.get("R2_PUBLIC_URL") or "").rstrip("/")
    if public_base and r2_uri.startswith("r2://"):
        without = r2_uri[len("r2://"):]
        _bucket, _, key = without.partition("/")
        if key:
            return f"{public_base}/{key}"

    api_base = (
        os.environ.get("PUBLIC_API_URL")
        or os.environ.get("API_URL")
        or "http://localhost:3000"
    ).rstrip("/")
    if asset_id is not None:
        q = f"?variant={variant}" if variant and variant != "optimized" else ""
        return f"{api_base}/api/media/assets/{asset_id}/content{q}"
    return r2_uri


def optimize_image(img, size=None, quality=85):
    """Convert to RGB WebP buffer (optionally resized). Applies EXIF orientation first."""
    work = ImageOps.exif_transpose(img) or img.copy()
    if work.mode in ("RGBA", "P"):
        work = work.convert("RGB")
    elif work.mode != "RGB":
        work = work.convert("RGB")
    if size:
        work.thumbnail(size, Image.Resampling.LANCZOS)
    buf = BytesIO()
    work.save(buf, format="WEBP", optimize=True, quality=quality)
    buf.seek(0)
    return buf


def generate_thumbnail(img):
    return optimize_image(img, SIZES["thumbnail"], quality=80)


def generate_responsive_sizes(img):
    return {
        "medium": optimize_image(img, SIZES["medium"], quality=85),
        "large": optimize_image(img, SIZES["large"], quality=85),
    }


def upload_to_r2(r2, bucket_name, key, buf, content_type="image/webp"):
    buf.seek(0)
    r2.upload_fileobj(
        buf,
        bucket_name,
        key,
        ExtraArgs={"ContentType": content_type, "CacheControl": "public, max-age=31536000"},
    )
    return f"r2://{bucket_name}/{key}"


def cleanup_temp_file(local_path=None, r2=None, bucket=None, key=None):
    if local_path and os.path.exists(local_path):
        try:
            os.remove(local_path)
        except OSError as e:
            logger.warning("Failed to remove local temp %s: %s", local_path, e)
    if r2 and bucket and key:
        try:
            r2.delete_object(Bucket=bucket, Key=key)
            logger.info("Deleted temp R2 object s3://%s/%s", bucket, key)
        except Exception as e:
            logger.warning("Failed to delete temp R2 object %s/%s: %s", bucket, key, e)


def _fetch_asset_row(cur, asset_id, store_id):
    if store_id is not None and str(store_id) != "global":
        cur.execute(
            """
            SELECT id, store_id, status, r2_optimized_key, r2_thumbnail_key,
                   r2_medium_key, r2_large_key, r2_object_key
            FROM media_asset
            WHERE id = %s AND store_id = %s
            """,
            (asset_id, store_id),
        )
    else:
        cur.execute(
            """
            SELECT id, store_id, status, r2_optimized_key, r2_thumbnail_key,
                   r2_medium_key, r2_large_key, r2_object_key
            FROM media_asset
            WHERE id = %s
            """,
            (asset_id,),
        )
    return cur.fetchone()


def mark_media_failed(asset_id, store_id, error_message):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        msg = (error_message or "Processing failed")[:2000]
        if store_id is not None and str(store_id) != "global":
            cur.execute(
                """
                UPDATE media_asset
                SET status = %s, error_message = %s, updated_at = NOW()
                WHERE id = %s AND store_id = %s AND COALESCE(status, '') <> %s
                """,
                (STATUS_FAILED, msg, asset_id, store_id, STATUS_DELETED),
            )
        else:
            cur.execute(
                """
                UPDATE media_asset
                SET status = %s, error_message = %s, updated_at = NOW()
                WHERE id = %s AND COALESCE(status, '') <> %s
                """,
                (STATUS_FAILED, msg, asset_id, STATUS_DELETED),
            )
        cur.execute(
            """
            UPDATE media_task
            SET status = %s, error_message = %s, completed_at = NOW(), updated_at = NOW()
            WHERE media_id = %s AND status = %s
            """,
            (STATUS_FAILED, msg, asset_id, STATUS_PROCESSING),
        )
        conn.commit()
        cur.close()
        conn.close()
    except Exception:
        logger.exception("Failed to mark media %s as failed", asset_id)


def mark_task_ready(asset_id, result_payload=None):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE media_task
            SET status = %s, result = %s, completed_at = NOW(), updated_at = NOW(), error_message = NULL
            WHERE media_id = %s AND status = %s
            """,
            (
                STATUS_READY,
                json.dumps(result_payload) if result_payload is not None else None,
                asset_id,
                STATUS_PROCESSING,
            ),
        )
        conn.commit()
        cur.close()
        conn.close()
    except Exception:
        logger.exception("Failed to mark media_task ready for %s", asset_id)


@app.task(
    name='media_worker.tasks.cleanup_temp_file',
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=3,
)
def cleanup_temp_file_task(source=None, local_path=None):
    bucket_name = os.environ.get("R2_BUCKET_NAME", "simple-meesho-media")
    r2 = get_r2_client()
    temp_bucket = temp_key = None
    if source:
        mode, bucket, key_or_path = parse_r2_source(source, bucket_name)
        if mode == "r2":
            temp_bucket, temp_key = bucket, key_or_path
        elif mode == "local":
            local_path = key_or_path
    cleanup_temp_file(local_path=local_path, r2=r2, bucket=temp_bucket, key=temp_key)
    return {"status": "cleaned"}


@app.task(
    name='media_worker.tasks.process_image',
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=120,
    max_retries=5,
    acks_late=True,
)
def process_image(self, source, asset_id, original_name, mime_type, store_id=None):
    """
    Idempotent image pipeline:
    temp source → validate → WebP variants → R2 → Postgres READY → delete temp.
    Retries overwrite the same object keys (no duplicate media rows).
    """
    bucket_name = os.environ.get("R2_BUCKET_NAME", "simple-meesho-media")
    r2 = get_r2_client()
    local_path_to_cleanup = None
    temp_bucket = None
    temp_key = None

    resolved_store_id = store_id
    if resolved_store_id is None or resolved_store_id == "":
        resolved_store_id = "global"

    try:
        # Idempotency: skip if already ready with optimized key present
        conn = get_db_connection()
        cur = conn.cursor()
        row = _fetch_asset_row(cur, asset_id, resolved_store_id)
        if not row:
            cur.close()
            conn.close()
            raise ValueError(f"Media asset {asset_id} not found for store {resolved_store_id}")

        _id, db_store_id, status, r2_opt, r2_thumb, r2_med, r2_large, r2_obj = row
        status_l = (status or "").lower()
        if status_l in (STATUS_DELETED, "deleted"):
            cur.close()
            conn.close()
            logger.info("Skipping deleted media %s", asset_id)
            return {"status": "skipped", "reason": "deleted", "asset_id": asset_id}

        if status_l in (STATUS_READY, "completed", "ready") and r2_opt:
            cur.close()
            conn.close()
            # Still try to clean leftover temp from a previous crash
            cleanup_temp_file_task.delay(source=source)
            logger.info("Skipping already-ready media %s (idempotent)", asset_id)
            return {"status": "success", "asset_id": asset_id, "idempotent": True}

        # Claim processing (prevents duplicate concurrent workers racing)
        if resolved_store_id != "global":
            cur.execute(
                """
                UPDATE media_asset
                SET status = %s, error_message = NULL, updated_at = NOW()
                WHERE id = %s AND store_id = %s AND COALESCE(status, '') <> %s
                """,
                (STATUS_PROCESSING, asset_id, resolved_store_id, STATUS_DELETED),
            )
        else:
            cur.execute(
                """
                UPDATE media_asset
                SET status = %s, error_message = NULL, updated_at = NOW()
                WHERE id = %s AND COALESCE(status, '') <> %s
                """,
                (STATUS_PROCESSING, asset_id, STATUS_DELETED),
            )
        conn.commit()
        cur.close()
        conn.close()

        if db_store_id and resolved_store_id == "global":
            resolved_store_id = db_store_id

        image_buf, local_path_to_cleanup, temp_bucket, temp_key = load_image_bytes(
            source, r2, bucket_name
        )

        with Image.open(image_buf) as opened:
            opened.load()
            fmt = (opened.format or "").upper()
            if fmt and fmt not in ALLOWED_FORMATS:
                raise ValueError(f"Unsupported image format: {fmt}")

            # Normalize camera/phone EXIF orientation before sizing (prevents sideways images)
            img = ImageOps.exif_transpose(opened) or opened

            width, height = img.size
            if width < 1 or height < 1 or width > MAX_DIMENSION or height > MAX_DIMENSION:
                raise ValueError(f"Invalid image dimensions: {width}x{height}")

            # Optimized + responsive variants (deterministic keys → idempotent R2 writes)
            buffers = {
                "optimized": optimize_image(img, None, quality=85),
                "thumbnail": generate_thumbnail(img),
            }
            buffers.update(generate_responsive_sizes(img))

            keys = {}
            total_size = 0
            for size_name, buf in buffers.items():
                file_size = buf.getbuffer().nbytes
                total_size += file_size
                key = f"stores/{resolved_store_id}/media/{asset_id}/{size_name}.webp"
                keys[size_name] = upload_to_r2(r2, bucket_name, key, buf)

            original_width, original_height = width, height

        # Optional AVIF companion (best-effort; many Pillow builds lack AVIF encoder)
        try:
            opt_bytes = buffers["optimized"].getvalue()
            with Image.open(BytesIO(opt_bytes)) as avif_source:
                if avif_source.mode != "RGB":
                    avif_source = avif_source.convert("RGB")
                avif_buf = BytesIO()
                avif_source.save(avif_buf, format="AVIF", quality=50)
                avif_buf.seek(0)
                avif_key = f"stores/{resolved_store_id}/media/{asset_id}/optimized.avif"
                upload_to_r2(r2, bucket_name, avif_key, avif_buf, content_type="image/avif")
        except Exception as avif_err:
            logger.info("AVIF encode skipped for media %s: %s", asset_id, avif_err)

        r2_url = keys["optimized"]
        thumb_uri = keys["thumbnail"]
        original_http = public_or_asset_url(r2_url, asset_id, "optimized")
        thumb_http = public_or_asset_url(thumb_uri, asset_id, "thumbnail")

        responsive_keys = json.dumps({
            "thumbnail": keys["thumbnail"],
            "medium": keys["medium"],
            "large": keys["large"],
            "optimized": keys["optimized"],
        })
        thumb_keys = json.dumps({"small": keys["thumbnail"]})

        conn = get_db_connection()
        cur = conn.cursor()
        if resolved_store_id != "global":
            cur.execute(
                """
                UPDATE media_asset
                SET
                    status = %s,
                    file_size = %s,
                    width = %s,
                    height = %s,
                    r2_object_key = %s,
                    bucket_name = %s,
                    responsive_keys = %s,
                    thumbnail_keys = %s,
                    original_url = %s,
                    thumbnail_url = %s,
                    webp_url = %s,
                    r2_optimized_key = %s,
                    r2_thumbnail_key = %s,
                    r2_medium_key = %s,
                    r2_large_key = %s,
                    error_message = NULL,
                    optimized_size = %s,
                    updated_at = NOW()
                WHERE id = %s AND store_id = %s AND COALESCE(status, '') <> %s
                """,
                (
                    STATUS_READY,
                    total_size,
                    original_width,
                    original_height,
                    r2_url,
                    bucket_name,
                    responsive_keys,
                    thumb_keys,
                    original_http,
                    thumb_http,
                    original_http,
                    keys["optimized"],
                    keys["thumbnail"],
                    keys["medium"],
                    keys["large"],
                    total_size,
                    asset_id,
                    resolved_store_id,
                    STATUS_DELETED,
                ),
            )
        else:
            cur.execute(
                """
                UPDATE media_asset
                SET
                    status = %s,
                    file_size = %s,
                    width = %s,
                    height = %s,
                    r2_object_key = %s,
                    bucket_name = %s,
                    responsive_keys = %s,
                    thumbnail_keys = %s,
                    original_url = %s,
                    thumbnail_url = %s,
                    webp_url = %s,
                    r2_optimized_key = %s,
                    r2_thumbnail_key = %s,
                    r2_medium_key = %s,
                    r2_large_key = %s,
                    error_message = NULL,
                    optimized_size = %s,
                    updated_at = NOW()
                WHERE id = %s AND COALESCE(status, '') <> %s
                """,
                (
                    STATUS_READY,
                    total_size,
                    original_width,
                    original_height,
                    r2_url,
                    bucket_name,
                    responsive_keys,
                    thumb_keys,
                    original_http,
                    thumb_http,
                    original_http,
                    keys["optimized"],
                    keys["thumbnail"],
                    keys["medium"],
                    keys["large"],
                    total_size,
                    asset_id,
                    STATUS_DELETED,
                ),
            )
        conn.commit()
        cur.close()
        conn.close()

        mark_task_ready(asset_id, {"key": r2_url, "sizes": list(keys.keys())})

        # Delete temporary original (local and/or R2 temp/) — never keep originals
        cleanup_temp_file(
            local_path=local_path_to_cleanup,
            r2=r2,
            bucket=temp_bucket,
            key=temp_key,
        )
        # Also clear any temp/ prefix leftovers
        if str(resolved_store_id) != "global":
            temp_prefix = f"stores/{resolved_store_id}/media/{asset_id}/temp/"
            try:
                listed = r2.list_objects_v2(Bucket=bucket_name, Prefix=temp_prefix)
                for obj in listed.get("Contents") or []:
                    r2.delete_object(Bucket=bucket_name, Key=obj["Key"])
            except Exception as e:
                logger.warning("Temp prefix cleanup warning: %s", e)

        return {"status": "success", "asset_id": asset_id, "key": r2_url, "store_id": resolved_store_id}

    except Exception as e:
        logger.exception("process_image failed for media %s: %s", asset_id, e)
        # Only mark FAILED when retries are exhausted to avoid flicker during transient R2 errors
        retries = getattr(self.request, "retries", 0)
        max_retries = getattr(self, "max_retries", 5) or 5
        if retries >= max_retries:
            mark_media_failed(asset_id, resolved_store_id, str(e))
            # Keep temp object so admin retry can re-queue without re-upload
        raise


@app.task(name='media_worker.tasks.delete_store_account', bind=True, max_retries=3)
def delete_store_account(self, store_id, user_id):
    logger.info("Starting account deletion for store_id=%s, user_id=%s", store_id, user_id)
    
    # 1. Cloudflare R2 Cleanup
    # Delete all objects matching stores/{store_id}/
    r2_access_key = os.environ.get("R2_ACCESS_KEY_ID")
    r2_secret_key = os.environ.get("R2_SECRET_ACCESS_KEY")
    r2_endpoint = os.environ.get("R2_ENDPOINT_URL")
    bucket_name = os.environ.get("R2_BUCKET_NAME", "simple-meesho")
    
    if r2_access_key and r2_secret_key:
        try:
            r2 = boto3.client(
                "s3",
                endpoint_url=r2_endpoint,
                aws_access_key_id=r2_access_key,
                aws_secret_access_key=r2_secret_key,
                region_name="auto"
            )
            prefix = f"stores/{store_id}/"
            paginator = r2.get_paginator('list_objects_v2')
            for page in paginator.paginate(Bucket=bucket_name, Prefix=prefix):
                if 'Contents' in page:
                    objects_to_delete = [{'Key': obj['Key']} for obj in page['Contents']]
                    for i in range(0, len(objects_to_delete), 1000):
                        r2.delete_objects(
                            Bucket=bucket_name,
                            Delete={'Objects': objects_to_delete[i:i+1000]}
                        )
            logger.info("Deleted R2 objects for store_id=%s", store_id)
        except Exception as e:
            logger.error("Failed to delete R2 objects for store_id=%s: %s", store_id, e)
            # Proceed to DB deletion even if R2 fails
    
    # 2. Database Cleanup
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # We wrap each deletion in a subtransaction (SAVEPOINT) so that if a table doesn't exist 
        # (e.g. cart table was removed), it doesn't abort the entire transaction.
        
        queries = [
            "DELETE FROM order_item WHERE order_id IN (SELECT id FROM \"order\" WHERE store_id = %s)",
            "DELETE FROM payment WHERE order_id IN (SELECT id FROM \"order\" WHERE store_id = %s)",
            "DELETE FROM shipment WHERE store_id = %s",
            "DELETE FROM \"order\" WHERE store_id = %s",
            
            "DELETE FROM product_collections WHERE product_id IN (SELECT id FROM product WHERE store_id = %s)",
            "DELETE FROM product_image WHERE product_id IN (SELECT id FROM product WHERE store_id = %s)",
            "DELETE FROM product_review WHERE product_id IN (SELECT id FROM product WHERE store_id = %s)",
            "DELETE FROM product_variant WHERE product_id IN (SELECT id FROM product WHERE store_id = %s)",
            "DELETE FROM product WHERE store_id = %s",
            "DELETE FROM collection WHERE store_id = %s",
            
            "DELETE FROM cart_item WHERE cart_id IN (SELECT id FROM cart WHERE store_id = %s)",
            "DELETE FROM cart WHERE store_id = %s",
            
            "DELETE FROM inbox_message WHERE conversation_id IN (SELECT id FROM inbox_conversation WHERE store_id = %s)",
            "DELETE FROM inbox_conversation WHERE store_id = %s",
            "DELETE FROM customer WHERE store_id = %s",
            
            "DELETE FROM coupon_usage WHERE coupon_id IN (SELECT id FROM coupon WHERE store_id = %s)",
            "DELETE FROM coupon WHERE store_id = %s",
            "DELETE FROM discount WHERE store_id = %s",
            "DELETE FROM promotion WHERE store_id = %s",
            
            "DELETE FROM email_campaign WHERE store_id = %s",
            "DELETE FROM newsletter WHERE store_id = %s",
            "DELETE FROM store_notification WHERE store_id = %s",
            
            "DELETE FROM page WHERE store_id = %s",
            "DELETE FROM instagram_config WHERE store_id = %s",
            "DELETE FROM shiprocket_config WHERE store_id = %s",
            "DELETE FROM whatsapp_config WHERE store_id = %s",
            
            "DELETE FROM site_settings WHERE store_id = %s",
            "DELETE FROM store_seo WHERE store_id = %s",
            "DELETE FROM store_payment_config WHERE store_id = %s",
            "DELETE FROM payment_webhook_log WHERE store_id = %s",
            
            "DELETE FROM subscription_invoice WHERE store_id = %s",
            "DELETE FROM subscription WHERE store_id = %s",
            
            "DELETE FROM support_chat_message WHERE store_id = %s",
            "DELETE FROM support_feedback WHERE store_id = %s",
            
            "DELETE FROM shipping_rate WHERE zone_id IN (SELECT id FROM shipping_zone WHERE store_id = %s)",
            "DELETE FROM shipping_zone WHERE store_id = %s",
            "DELETE FROM tax_region WHERE store_id = %s",
            
            "DELETE FROM store_staff WHERE store_id = %s",
            "DELETE FROM stock_provider_config WHERE store_id = %s",
            "DELETE FROM blog_post WHERE store_id = %s",
            "DELETE FROM wishlist_item WHERE store_id = %s",
            
            "DELETE FROM store_theme WHERE store_id = %s",
            
            "DELETE FROM media_task WHERE store_id = %s",
            "DELETE FROM media_asset WHERE store_id = %s",
            
            "DELETE FROM account_deletion_task WHERE store_id = %s",
            "DELETE FROM domain WHERE store_id = %s",
            
            "DELETE FROM store_user WHERE store_id = %s",
            "DELETE FROM store WHERE id = %s",
            
            "DELETE FROM \"user\" WHERE id = %s AND NOT EXISTS (SELECT 1 FROM store_user WHERE user_id = %s)"
        ]
        
        for q in queries:
            try:
                cur.execute("SAVEPOINT batch_savepoint")
                if q.startswith("DELETE FROM \"user\""):
                    cur.execute(q, (user_id, user_id))
                else:
                    cur.execute(q, (store_id,))
                cur.execute("RELEASE SAVEPOINT batch_savepoint")
            except Exception as eq:
                cur.execute("ROLLBACK TO SAVEPOINT batch_savepoint")
                logger.warning("Error executing deletion (safe to ignore if table doesn't exist) %s: %s", q, eq)
                
        conn.commit()
        cur.close()
        conn.close()
        logger.info("Successfully deleted database records for store_id=%s", store_id)
        return {"status": "success", "store_id": store_id, "user_id": user_id}
        
    except Exception as e:
        logger.exception("Database deletion failed for store_id=%s: %s", store_id, e)
        raise self.retry(exc=e)
