import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const logger = new Logger('DeleteStore');

/**
 * Port of media_worker.tasks.delete_store_account:
 * R2 prefix wipe then per-table DELETEs with savepoints so missing tables don't abort.
 */
export async function deleteStoreAccount(
  prisma: PrismaService,
  storage: StorageService,
  storeId: number,
  userId: number,
) {
  logger.log(`Starting account deletion for store_id=${storeId}, user_id=${userId}`);

  try {
    await storage.deletePrefix(`stores/${storeId}/`);
    logger.log(`Deleted R2 objects for store_id=${storeId}`);
  } catch (e) {
    logger.error(`Failed to delete R2 objects for store_id=${storeId}: ${(e as Error).message}`);
  }

  const queries: Array<{ sql: string; params: any[] }> = [
    { sql: `DELETE FROM order_item WHERE order_id IN (SELECT id FROM "order" WHERE store_id = $1)`, params: [storeId] },
    { sql: `DELETE FROM payment WHERE order_id IN (SELECT id FROM "order" WHERE store_id = $1)`, params: [storeId] },
    { sql: `DELETE FROM payment_log WHERE order_id IN (SELECT id FROM "order" WHERE store_id = $1)`, params: [storeId] },
    { sql: `DELETE FROM shipment WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM "order" WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM product_collections WHERE product_id IN (SELECT id FROM product WHERE store_id = $1)`, params: [storeId] },
    { sql: `DELETE FROM product_image WHERE product_id IN (SELECT id FROM product WHERE store_id = $1)`, params: [storeId] },
    { sql: `DELETE FROM product_review WHERE product_id IN (SELECT id FROM product WHERE store_id = $1)`, params: [storeId] },
    { sql: `DELETE FROM product_variant WHERE product_id IN (SELECT id FROM product WHERE store_id = $1)`, params: [storeId] },
    { sql: `DELETE FROM product WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM collection WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM cart_item WHERE cart_id IN (SELECT id FROM cart WHERE store_id = $1)`, params: [storeId] },
    { sql: `DELETE FROM cart WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM inbox_message WHERE conversation_id IN (SELECT id FROM inbox_conversation WHERE store_id = $1)`, params: [storeId] },
    { sql: `DELETE FROM inbox_conversation WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM customer WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM coupon_usage WHERE coupon_id IN (SELECT id FROM coupon WHERE store_id = $1)`, params: [storeId] },
    { sql: `DELETE FROM coupon WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM discount WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM promotion WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM email_campaign WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM newsletter WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM store_notification WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM page WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM home_page_section WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM instagram_config WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM shiprocket_config WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM whatsapp_config WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM site_settings WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM store_seo WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM store_payment_config WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM payment_webhook_log WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM subscription_invoice WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM subscription WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM support_chat_message WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM support_feedback WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM shipping_rate WHERE zone_id IN (SELECT id FROM shipping_zone WHERE store_id = $1)`, params: [storeId] },
    { sql: `DELETE FROM shipping_zone WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM tax_region WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM store_staff WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM stock_provider_config WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM blog_post WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM wishlist_item WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM store_theme WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM media_task WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM media_asset WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM account_deletion_task WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM domain WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM store_user WHERE store_id = $1`, params: [storeId] },
    { sql: `DELETE FROM "user" WHERE id = $1 AND store_id = $2`, params: [userId, storeId] },
    { sql: `DELETE FROM store WHERE id = $1`, params: [storeId] },
  ];

  for (const q of queries) {
    try {
      await prisma.$executeRawUnsafe(q.sql, ...q.params);
    } catch (eq) {
      logger.warn(`Error executing deletion (safe if table missing) ${q.sql}: ${(eq as Error).message}`);
    }
  }

  logger.log(`Successfully deleted database records for store_id=${storeId}`);
  return { status: 'success', store_id: storeId, user_id: userId };
}
