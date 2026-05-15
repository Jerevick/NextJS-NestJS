import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
