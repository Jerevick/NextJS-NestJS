import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { ObjectStorageService } from '../storage/object-storage.service';

@Injectable()
export class MeetingMinutesFileService {
  private readonly localRoot: string;

  constructor(
    private readonly storage: ObjectStorageService,
    config: ConfigService,
  ) {
    this.localRoot =
      config.get<string>('BILLING_EVIDENCE_DIR')?.trim() ||
      join(process.cwd(), '.storage', 'billing-evidence');
  }

  async storePlainTextMinutes(
    institutionId: string,
    entityId: string,
    meetingId: string,
    plainText: string,
  ) {
    const key = `meetings/minutes/${institutionId}/${entityId}/${meetingId}/${randomUUID()}.txt`;
    const buffer = Buffer.from(plainText, 'utf8');
    const stored = await this.storage.putBuffer(key, buffer, 'text/plain');
    return {
      minutesFileKey: stored.key,
      downloadUrl: await this.storage.resolveDownloadUrl(stored.key),
    };
  }

  async readPlainText(key: string | null | undefined): Promise<string | null> {
    if (!key) return null;
    if (key.startsWith('local://')) {
      const rel = key.slice('local://'.length);
      try {
        return await readFile(join(this.localRoot, rel), 'utf8');
      } catch {
        return null;
      }
    }
    return null;
  }
}
