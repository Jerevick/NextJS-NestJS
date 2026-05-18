import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from './ai.service';

@Injectable()
export class AiBillingAnomalyService {
  private readonly log = new Logger(AiBillingAnomalyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async detectInstitutionAnomalies(institutionId: string) {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 30);
    const snapshots = await this.prisma.dailyBillableSnapshot.findMany({
      where: { institutionId, snapshotDate: { gte: since } },
      orderBy: { snapshotDate: 'asc' },
    });
    const byEntity = new Map<string, typeof snapshots>();
    for (const row of snapshots) {
      const list = byEntity.get(row.entityId) ?? [];
      list.push(row);
      byEntity.set(row.entityId, list);
    }
    const flags: Array<{
      entityId: string;
      latest: number;
      avg7: number;
      avg30: number;
      dropPct7: number;
      dropPct30: number;
      potentialGamingRisk: boolean;
    }> = [];
    for (const [entityId, rows] of byEntity) {
      if (rows.length < 2) continue;
      const latest = rows[rows.length - 1]!.billableCount;
      const last7 = rows.slice(-7);
      const avg7 = last7.reduce((s, r) => s + r.billableCount, 0) / last7.length;
      const avg30 = rows.reduce((s, r) => s + r.billableCount, 0) / rows.length;
      const dropPct7 = avg7 > 0 ? ((avg7 - latest) / avg7) * 100 : 0;
      const dropPct30 = avg30 > 0 ? ((avg30 - latest) / avg30) * 100 : 0;
      if (dropPct7 > 10 || dropPct30 > 10) {
        flags.push({
          entityId,
          latest,
          avg7,
          avg30,
          dropPct7: Math.round(dropPct7 * 10) / 10,
          dropPct30: Math.round(dropPct30 * 10) / 10,
          potentialGamingRisk: dropPct7 > 10 && dropPct30 > 10,
        });
      }
    }
    let narrative: string | undefined;
    if (flags.length > 0) {
      narrative = await this.ai.complete(institutionId, [
        {
          role: 'system',
          content:
            'Summarize billing anomalies for operations team. Mention possible gaming or data issues; do not accuse.',
        },
        { role: 'user', content: JSON.stringify({ flags }) },
      ]);
      const webhook = process.env.BILLING_ANOMALY_WEBHOOK_URL?.trim();
      if (webhook) {
        try {
          await fetch(webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'billing_anomaly',
              institutionId,
              anomalyCount: flags.length,
              gamingRiskCount: flags.filter((f) => f.potentialGamingRisk).length,
              flags,
              narrative,
            }),
          });
        } catch (e) {
          this.log.warn(`Billing anomaly webhook failed: ${e}`);
        }
      } else {
        this.log.warn(
          `Billing anomaly detected for ${institutionId}: ${flags.length} entities (set BILLING_ANOMALY_WEBHOOK_URL for alerts)`,
        );
      }
    }
    return {
      institutionId,
      anomalyCount: flags.length,
      flags,
      narrative,
      isAIGenerated: Boolean(narrative),
    };
  }
}
