import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export type PutObjectResult = {
  key: string;
  url: string;
};

/**
 * Stores JSON artifacts (billing evidence, exports). Uses S3 when configured;
 * otherwise writes under BILLING_EVIDENCE_DIR (default: .storage/billing-evidence).
 */
@Injectable()
export class ObjectStorageService {
  private readonly log = new Logger(ObjectStorageService.name);
  private readonly localRoot: string;

  constructor(private readonly config: ConfigService) {
    this.localRoot =
      this.config.get<string>('BILLING_EVIDENCE_DIR')?.trim() ||
      join(process.cwd(), '.storage', 'billing-evidence');
  }

  private s3Enabled(): boolean {
    const bucket = this.config.get<string>('AWS_S3_BUCKET')?.trim();
    const region = this.config.get<string>('AWS_REGION')?.trim();
    return Boolean(bucket && region);
  }

  async putJson(key: string, payload: unknown): Promise<PutObjectResult> {
    const body = JSON.stringify(payload, null, 2);
    if (this.s3Enabled()) {
      return this.putS3(key, body, 'application/json');
    }
    return this.putLocal(key, body);
  }

  async putBuffer(key: string, body: Buffer, contentType: string): Promise<PutObjectResult> {
    if (this.s3Enabled()) {
      return this.putS3Binary(key, body, contentType);
    }
    return this.putLocalBinary(key, body);
  }

  /** Load stored binary (local path or S3 key). */
  async getBuffer(key: string): Promise<Buffer | null> {
    if (key.startsWith('local://')) {
      const rel = key.slice('local://'.length);
      try {
        return await readFile(join(this.localRoot, rel));
      } catch {
        return null;
      }
    }
    const bucket = this.config.get<string>('AWS_S3_BUCKET')?.trim();
    const region = this.config.get<string>('AWS_REGION')?.trim();
    if (!bucket || !region) {
      return null;
    }
    try {
      const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
      const endpoint = this.config.get<string>('AWS_S3_ENDPOINT')?.trim();
      const client = new S3Client({
        region,
        ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      });
      const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const bytes = await out.Body?.transformToByteArray();
      return bytes ? Buffer.from(bytes) : null;
    } catch (err) {
      this.log.warn(
        `getBuffer failed for ${key}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  /** Time-limited S3 presigned GET URL (default 1 hour). Returns null when S3 is not configured. */
  async getPresignedDownloadUrl(key: string, expiresInSec = 3600): Promise<string | null> {
    if (key.startsWith('local://')) {
      return this.getDownloadUrl(key);
    }
    const bucket = this.config.get<string>('AWS_S3_BUCKET')?.trim();
    const region = this.config.get<string>('AWS_REGION')?.trim();
    if (!bucket || !region) {
      return null;
    }
    try {
      const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      const endpoint = this.config.get<string>('AWS_S3_ENDPOINT')?.trim();
      const client = new S3Client({
        region,
        ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      });
      return await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
        expiresIn: expiresInSec,
      });
    } catch (err) {
      this.log.warn(
        `getPresignedDownloadUrl failed for ${key}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  /**
   * Prefer time-limited presigned URL when S3 is configured; otherwise static/local URL.
   */
  async resolveDownloadUrl(key: string, expiresInSec = 3600): Promise<string | null> {
    const presigned = await this.getPresignedDownloadUrl(key, expiresInSec);
    if (presigned) {
      return presigned;
    }
    return this.getDownloadUrl(key);
  }

  getDownloadUrl(key: string): string | null {
    if (key.startsWith('local://')) {
      const rel = key.slice('local://'.length);
      return `file://${join(this.localRoot, rel)}`;
    }
    const bucket = this.config.get<string>('AWS_S3_BUCKET')?.trim();
    const region = this.config.get<string>('AWS_REGION')?.trim();
    if (!bucket || !region) {
      return null;
    }
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  private async putLocalBinary(relativeKey: string, body: Buffer): Promise<PutObjectResult> {
    const fullPath = join(this.localRoot, relativeKey);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, body);
    const key = `local://${relativeKey}`;
    return { key, url: `file://${fullPath}` };
  }

  private async putS3Binary(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<PutObjectResult> {
    const bucket = this.config.get<string>('AWS_S3_BUCKET')!.trim();
    const region = this.config.get<string>('AWS_REGION')!.trim();
    const endpoint = this.config.get<string>('AWS_S3_ENDPOINT')?.trim();

    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({
      region,
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    });
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    const url = endpoint
      ? `${endpoint.replace(/\/$/, '')}/${bucket}/${key}`
      : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    this.log.log(`Uploaded binary s3://${bucket}/${key}`);
    return { key, url };
  }

  private async putLocal(relativeKey: string, body: string): Promise<PutObjectResult> {
    const fullPath = join(this.localRoot, relativeKey);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, body, 'utf8');
    const key = `local://${relativeKey}`;
    return { key, url: `file://${fullPath}` };
  }

  private async putS3(key: string, body: string, contentType: string): Promise<PutObjectResult> {
    const bucket = this.config.get<string>('AWS_S3_BUCKET')!.trim();
    const region = this.config.get<string>('AWS_REGION')!.trim();
    const endpoint = this.config.get<string>('AWS_S3_ENDPOINT')?.trim();

    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({
      region,
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    });
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    const url = endpoint
      ? `${endpoint.replace(/\/$/, '')}/${bucket}/${key}`
      : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    this.log.log(`Uploaded billing artifact s3://${bucket}/${key}`);
    return { key, url };
  }
}
