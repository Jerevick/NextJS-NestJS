import { Injectable, Logger } from '@nestjs/common';
import { EnrollmentHoldType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

type FinanceHoldSettings = {
  finance?: {
    autoFinancialHolds?: boolean;
    holdBalanceThreshold?: number;
    holdOverdueDays?: number;
  };
};

const SYSTEM_ACTOR = 'system-finance-holds';

@Injectable()
export class FinanceFinancialHoldsService {
  private readonly log = new Logger(FinanceFinancialHoldsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Daily scan: place FINANCIAL enrollment holds when balance exceeds threshold and account is overdue. */
  async scanAndPlaceHolds(): Promise<{ placed: number; scanned: number }> {
    const institutions = await this.prisma.institution.findMany({
      where: { deletedAt: null, status: 'ACTIVE' },
      select: { id: true, settings: true },
    });

    let placed = 0;
    let scanned = 0;

    for (const inst of institutions) {
      const settings = (inst.settings ?? {}) as FinanceHoldSettings;
      const finance = settings.finance ?? {};
      if (finance.autoFinancialHolds === false) {
        continue;
      }
      const threshold = finance.holdBalanceThreshold ?? 500;
      const overdueDays = finance.holdOverdueDays ?? 30;
      const cutoff = new Date(Date.now() - overdueDays * 86_400_000);

      const accounts = await this.prisma.studentAccount.findMany({
        where: {
          institutionId: inst.id,
          balance: { gt: threshold },
          OR: [{ lastTransactionAt: { lt: cutoff } }, { lastTransactionAt: null }],
        },
        include: {
          student: { select: { id: true, entityId: true, studentNumber: true } },
        },
        take: 500,
      });

      for (const account of accounts) {
        scanned += 1;
        const existing = await this.prisma.enrollmentHold.findFirst({
          where: {
            institutionId: inst.id,
            studentId: account.studentId,
            type: EnrollmentHoldType.FINANCIAL,
            liftedAt: null,
            deletedAt: null,
          },
        });
        if (existing) {
          continue;
        }

        const systemUser = await this.prisma.user.findFirst({
          where: { institutionId: inst.id, deletedAt: null },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        if (!systemUser) {
          continue;
        }

        const hold = await this.prisma.enrollmentHold.create({
          data: {
            institutionId: inst.id,
            entityId: account.entityId,
            studentId: account.studentId,
            type: EnrollmentHoldType.FINANCIAL,
            reason: `Outstanding balance ${Number(account.balance).toFixed(2)} ${account.currency} (overdue > ${overdueDays} days)`,
            placedById: systemUser.id,
          },
        });

        placed += 1;
        this.audit.append({
          institutionId: inst.id,
          actorId: SYSTEM_ACTOR,
          action: 'finance.hold.autoPlace',
          entity: 'EnrollmentHold',
          entityId: hold.id,
          newValues: {
            studentId: account.studentId,
            balance: Number(account.balance),
          } as Prisma.InputJsonValue,
        });
      }
    }

    if (placed > 0) {
      this.log.log(`Auto-placed ${placed} financial enrollment hold(s)`);
    }
    return { placed, scanned };
  }
}
