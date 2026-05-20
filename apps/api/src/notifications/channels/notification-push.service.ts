import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { PrismaService } from '../../prisma/prisma.service';
import {
  readNotificationSettings,
  readUserFcmTokens,
  type InstitutionPushSettings,
} from '../notification-channel-settings.util';

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

@Injectable()
export class NotificationPushService implements OnModuleDestroy {
  private readonly log = new Logger(NotificationPushService.name);
  private readonly apps = new Map<string, admin.app.App>();

  constructor(private readonly prisma: PrismaService) {}

  onModuleDestroy(): void {
    for (const app of this.apps.values()) {
      void app.delete().catch(() => undefined);
    }
    this.apps.clear();
  }

  /** Firebase Cloud Messaging — institution or platform service account. */
  async send(
    institutionId: string,
    userId: string,
    payload: PushPayload,
  ): Promise<{ sent: number; failed: number }> {
    const [inst, user] = await Promise.all([
      this.prisma.institution.findUnique({
        where: { id: institutionId },
        select: { settings: true },
      }),
      this.prisma.user.findFirst({
        where: { id: userId, institutionId, deletedAt: null },
        select: { profile: true },
      }),
    ]);

    const tokens = readUserFcmTokens(user?.profile);
    if (!tokens.length) {
      this.log.debug(`No FCM tokens for user ${userId}`);
      return { sent: 0, failed: 0 };
    }

    const channel = readNotificationSettings(inst?.settings);
    const pushCfg = channel.push ?? this.platformPush();
    const messaging = await this.getMessaging(institutionId, pushCfg);
    if (!messaging) {
      this.log.debug(`FCM not configured — push skipped for ${institutionId}`);
      return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;
    for (const token of tokens) {
      try {
        await messaging.send({
          token,
          notification: { title: payload.title, body: payload.body },
          data: payload.data,
        });
        sent += 1;
      } catch (err) {
        failed += 1;
        this.log.warn(
          `FCM send failed for ${userId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (sent === 0 && failed > 0) {
      throw new Error(`FCM delivery failed for all ${failed} token(s)`);
    }
    return { sent, failed };
  }

  private platformPush(): InstitutionPushSettings | null {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
    if (!raw) return null;
    return { serviceAccountJson: raw };
  }

  private parseServiceAccount(raw: string | Record<string, unknown>): admin.ServiceAccount | null {
    try {
      const obj = typeof raw === 'string' ? (JSON.parse(raw) as Record<string, unknown>) : raw;
      if (!obj || typeof obj !== 'object' || !obj.project_id || !obj.private_key) {
        return null;
      }
      return obj as admin.ServiceAccount;
    } catch {
      return null;
    }
  }

  private async getMessaging(
    institutionId: string,
    cfg: InstitutionPushSettings | null,
  ): Promise<admin.messaging.Messaging | null> {
    const cacheKey = institutionId;
    let app = this.apps.get(cacheKey);
    if (!app) {
      const sa = cfg?.serviceAccountJson ? this.parseServiceAccount(cfg.serviceAccountJson) : null;
      if (!sa) return null;
      const name = `unicore-notify-${institutionId}`;
      try {
        app = admin.app(name);
      } catch {
        app = admin.initializeApp(
          {
            credential: admin.credential.cert(sa),
            projectId: cfg?.projectId ?? (sa as { project_id?: string }).project_id,
          },
          name,
        );
      }
      this.apps.set(cacheKey, app);
    }
    return admin.messaging(app);
  }
}
