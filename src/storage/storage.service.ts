import { Injectable, Logger } from '@nestjs/common';
import { createWriteStream } from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private s3: S3Client;
  private bucketName: string;
  private readonly logger = new Logger(StorageService.name);
  private publicUrl: string;

  constructor() {
    const accessKeyId = (process.env.R2_ACCESS_KEY_ID || '').trim();
    const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').trim();
    this.bucketName = (process.env.R2_BUCKET_NAME || '').trim();
    this.publicUrl = (process.env.R2_PUBLIC_URL || '').trim().replace(/\/$/, '');

    const endpoint = (
      process.env.R2_ENDPOINT_URL ||
      (process.env.R2_ACCOUNT_ID
        ? `https://${process.env.R2_ACCOUNT_ID.trim()}.r2.cloudflarestorage.com`
        : '')
    ).trim() || undefined;

    this.s3 = new S3Client({
      region: 'auto',
      endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    });

    this.logger.log(
      `R2 client bucket=${this.bucketName || '(none)'} endpoint=${endpoint || '(none)'} key=${accessKeyId ? accessKeyId.slice(0, 6) + '…' : '(missing)'}`,
    );
  }

  getBucketName(): string {
    return this.bucketName;
  }

  isConfigured(): boolean {
    return Boolean(process.env.R2_ACCESS_KEY_ID && this.bucketName);
  }

  toR2Uri(key: string): string {
    return `r2://${this.bucketName}/${key.replace(/^\//, '')}`;
  }

  parseObjectKey(keyOrUri: string): string {
    if (!keyOrUri) return '';
    if (keyOrUri.startsWith('http')) {
      try {
        const url = new URL(keyOrUri);
        return url.pathname.replace(/^\//, '');
      } catch {
        return keyOrUri;
      }
    }
    if (keyOrUri.startsWith('r2://')) {
      const withoutPrefix = keyOrUri.replace('r2://', '');
      const parts = withoutPrefix.split('/');
      return parts.slice(1).join('/');
    }
    return keyOrUri.replace(/^\//, '');
  }

  /** Cloud-only upload. Throws if R2 is not configured or upload fails. */
  async uploadFile(fileBuffer: Buffer, key: string, contentType: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('R2 storage is not configured (R2_ACCESS_KEY_ID / R2_BUCKET_NAME)');
    }

    const objectKey = key.replace(/^\//, '');
    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: objectKey,
          Body: fileBuffer,
          ContentType: contentType,
        }),
      );
    } catch (e) {
      this.logger.error('R2 upload error:', e);
      throw new Error(`Failed to upload to R2: ${(e as Error).message}`);
    }

    if (this.publicUrl) {
      return `${this.publicUrl}/${objectKey}`;
    }

    // No public CDN URL configured — return a temporary signed URL for immediate use
    return this.getSignedUrl(objectKey, 7200);
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (key.startsWith('http')) return key;

    const objectKey = this.parseObjectKey(key);

    if (!this.isConfigured()) {
      throw new Error('R2 storage is not configured');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
      });
      return await getSignedUrl(this.s3, command, { expiresIn });
    } catch (e) {
      this.logger.error(`Failed to sign URL for ${key}`, e);
      throw e;
    }
  }

  /** Stream object from R2 (avoids buffering entire files in heap). */
  async getObjectStream(
    keyOrUri: string,
  ): Promise<{ body: any; contentType: string; contentLength?: number } | null> {
    if (!this.isConfigured() || !keyOrUri) return null;
    const objectKey = this.parseObjectKey(keyOrUri);
    if (!objectKey) return null;
    try {
      const result = await this.s3.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: objectKey,
        }),
      );
      if (!result.Body) return null;
      return {
        body: result.Body,
        contentType: result.ContentType || 'image/webp',
        contentLength: result.ContentLength,
      };
    } catch (e) {
      this.logger.warn(`Failed to stream R2 object ${objectKey}: ${(e as Error).message}`);
      return null;
    }
  }

  async downloadToFile(keyOrUri: string, dest: string, maxBytes?: number): Promise<boolean> {
    const obj = await this.getObjectStream(keyOrUri);
    if (!obj?.body) return false;
    if (maxBytes && obj.contentLength && obj.contentLength > maxBytes) {
      throw new Error(`Object too large (${obj.contentLength} bytes)`);
    }
    const body = obj.body as any;
    const nodeStream =
      typeof body.pipe === 'function'
        ? body
        : Readable.fromWeb(body.transformToWebStream ? body.transformToWebStream() : body);
    await pipeline(nodeStream, createWriteStream(dest));
    return true;
  }

  /** Fetch object bytes from R2 (prefer getObjectStream for large files). */
  async getObjectBuffer(keyOrUri: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    if (!this.isConfigured() || !keyOrUri) return null;
    const objectKey = this.parseObjectKey(keyOrUri);
    if (!objectKey) return null;
    try {
      const result = await this.s3.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: objectKey,
        }),
      );
      if (!result.Body) return null;
      const bytes = await result.Body.transformToByteArray();
      return {
        buffer: Buffer.from(bytes),
        contentType: result.ContentType || 'image/webp',
      };
    } catch (e) {
      this.logger.warn(`Failed to get R2 object ${objectKey}: ${(e as Error).message}`);
      return null;
    }
  }

  async deleteFile(keyOrUri: string): Promise<void> {
    if (!this.isConfigured() || !keyOrUri) return;
    const objectKey = this.parseObjectKey(keyOrUri);
    if (!objectKey) return;
    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: objectKey,
        }),
      );
    } catch (e) {
      this.logger.warn(`Failed to delete R2 object ${objectKey}: ${(e as Error).message}`);
    }
  }

  /** Delete all objects under a prefix (e.g. stores/{storeId}/media/{mediaId}/). */
  async deletePrefix(prefix: string): Promise<void> {
    if (!this.isConfigured() || !prefix) return;
    const normalized = prefix.replace(/^\//, '').replace(/\.\./g, '');
    try {
      let continuationToken: string | undefined;
      do {
        const listed = await this.s3.send(
          new ListObjectsV2Command({
            Bucket: this.bucketName,
            Prefix: normalized,
            ContinuationToken: continuationToken,
          }),
        );
        const keys = (listed.Contents || [])
          .map((o) => o.Key)
          .filter((k): k is string => Boolean(k));
        if (keys.length > 0) {
          await this.s3.send(
            new DeleteObjectsCommand({
              Bucket: this.bucketName,
              Delete: { Objects: keys.map((Key) => ({ Key })) },
            }),
          );
        }
        continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
      } while (continuationToken);
    } catch (e) {
      this.logger.warn(`Failed to delete R2 prefix ${normalized}: ${(e as Error).message}`);
    }
  }
}
