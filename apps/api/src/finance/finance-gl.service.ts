import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FinanceGlAccountType, FinanceGlNormalBalance, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  FINANCE_CHART_OF_ACCOUNTS_VERSION,
  INSTITUTION_DEFAULT_CHART_OF_ACCOUNTS,
  ledgerLinesAreBalanced,
} from './finance-chart-of-accounts';
import type { LedgerEntryLine } from './finance-ledger-entries.util';

@Injectable()
export class FinanceGlService {
  private readonly log = new Logger(FinanceGlService.name);

  constructor(private readonly prisma: PrismaService) {}

  async ensureInstitutionChart(institutionId: string) {
    const count = await this.prisma.financeGlAccount.count({
      where: { institutionId, isActive: true },
    });
    if (count > 0) {
      return { seeded: false, count };
    }
    await this.prisma.financeGlAccount.createMany({
      data: INSTITUTION_DEFAULT_CHART_OF_ACCOUNTS.map((row) => ({
        institutionId,
        code: row.code,
        name: row.name,
        type: row.type as FinanceGlAccountType,
        normalBalance:
          row.normalBalance === 'DEBIT'
            ? FinanceGlNormalBalance.DEBIT
            : FinanceGlNormalBalance.CREDIT,
        isSystem: true,
        isActive: true,
      })),
      skipDuplicates: true,
    });
    return { seeded: true, count: INSTITUTION_DEFAULT_CHART_OF_ACCOUNTS.length };
  }

  async listAccounts(institutionId: string, options?: { includeInactive?: boolean }) {
    await this.ensureInstitutionChart(institutionId);
    const rows = await this.prisma.financeGlAccount.findMany({
      where: {
        institutionId,
        ...(options?.includeInactive ? {} : { isActive: true }),
      },
      orderBy: { code: 'asc' },
    });
    return {
      version: FINANCE_CHART_OF_ACCOUNTS_VERSION,
      accounts: rows.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        type: r.type,
        normalBalance: r.normalBalance,
        isSystem: r.isSystem,
        isActive: r.isActive,
      })),
    };
  }

  async upsertAccount(
    institutionId: string,
    dto: {
      code: string;
      name: string;
      type: FinanceGlAccountType;
      normalBalance: FinanceGlNormalBalance;
      isActive?: boolean;
    },
  ) {
    await this.ensureInstitutionChart(institutionId);
    const code = dto.code.trim().toUpperCase();
    if (!/^[A-Z0-9-]{2,32}$/.test(code)) {
      throw new BadRequestException('Account code must be 2–32 chars (A-Z, 0-9, hyphen)');
    }
    const existing = await this.prisma.financeGlAccount.findUnique({
      where: { institutionId_code: { institutionId, code } },
    });
    if (existing?.isSystem) {
      const row = await this.prisma.financeGlAccount.update({
        where: { id: existing.id },
        data: {
          isActive: dto.isActive ?? existing.isActive,
        },
      });
      return {
        id: row.id,
        code: row.code,
        name: row.name,
        type: row.type,
        normalBalance: row.normalBalance,
        isSystem: true,
        isActive: row.isActive,
      };
    }
    const row = await this.prisma.financeGlAccount.upsert({
      where: { institutionId_code: { institutionId, code } },
      create: {
        institutionId,
        code,
        name: dto.name.trim(),
        type: dto.type,
        normalBalance: dto.normalBalance,
        isSystem: false,
        isActive: dto.isActive ?? true,
      },
      update: {
        name: dto.name.trim(),
        type: dto.type,
        normalBalance: dto.normalBalance,
        isActive: dto.isActive ?? true,
      },
    });
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      type: row.type,
      normalBalance: row.normalBalance,
      isSystem: row.isSystem,
      isActive: row.isActive,
    };
  }

  async setAccountActive(institutionId: string, accountId: string, isActive: boolean) {
    const row = await this.prisma.financeGlAccount.findFirst({
      where: { id: accountId, institutionId },
    });
    if (!row) {
      throw new NotFoundException('GL account not found');
    }
    const updated = await this.prisma.financeGlAccount.update({
      where: { id: accountId },
      data: { isActive },
    });
    return {
      id: updated.id,
      code: updated.code,
      isActive: updated.isActive,
    };
  }

  parseLedgerLinesFromMetadata(metadata: unknown): LedgerEntryLine[] {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return [];
    }
    const raw = (metadata as Record<string, unknown>).ledgerEntries;
    if (!Array.isArray(raw)) {
      return [];
    }
    const lines: LedgerEntryLine[] = [];
    for (const row of raw) {
      if (!row || typeof row !== 'object') continue;
      const o = row as Record<string, unknown>;
      const account = typeof o.account === 'string' ? o.account : '';
      const debit = typeof o.debit === 'number' ? o.debit : Number(o.debit);
      const credit = typeof o.credit === 'number' ? o.credit : Number(o.credit);
      if (!account || !Number.isFinite(debit) || !Number.isFinite(credit)) continue;
      lines.push({ account, debit, credit });
    }
    return lines;
  }

  /**
   * Persists balanced journal lines for a completed transaction (idempotent per transaction).
   */
  async postJournalLinesForTransaction(
    tx: Prisma.TransactionClient,
    args: {
      institutionId: string;
      entityId: string;
      financeTransactionId: string;
      metadata: unknown;
    },
  ) {
    const existing = await tx.financeGlJournalLine.count({
      where: { financeTransactionId: args.financeTransactionId },
    });
    if (existing > 0) {
      return { posted: false, reason: 'already_posted' as const };
    }

    const lines = this.parseLedgerLinesFromMetadata(args.metadata);
    if (lines.length === 0 || !ledgerLinesAreBalanced(lines)) {
      return { posted: false, reason: 'no_balanced_lines' as const };
    }

    await this.ensureInstitutionChart(args.institutionId);

    const activeCodes = new Set(
      (
        await tx.financeGlAccount.findMany({
          where: { institutionId: args.institutionId, isActive: true },
          select: { code: true },
        })
      ).map((a) => a.code),
    );
    for (const line of lines) {
      if (!activeCodes.has(line.account)) {
        this.log.warn(
          `GL account ${line.account} missing for institution ${args.institutionId}; skipping journal post`,
        );
        return { posted: false, reason: 'unknown_account' as const };
      }
    }

    const postedAt = new Date();
    await tx.financeGlJournalLine.createMany({
      data: lines.map((line) => ({
        institutionId: args.institutionId,
        entityId: args.entityId,
        financeTransactionId: args.financeTransactionId,
        accountCode: line.account,
        debit: new Prisma.Decimal(line.debit),
        credit: new Prisma.Decimal(line.credit),
        postedAt,
      })),
    });

    return { posted: true, lineCount: lines.length };
  }

  async getJournalForTransaction(institutionId: string, financeTransactionId: string) {
    const lines = await this.prisma.financeGlJournalLine.findMany({
      where: { institutionId, financeTransactionId },
      orderBy: { accountCode: 'asc' },
    });
    return {
      financeTransactionId,
      lines: lines.map((l) => ({
        accountCode: l.accountCode,
        debit: Number(l.debit),
        credit: Number(l.credit),
        postedAt: l.postedAt.toISOString(),
      })),
    };
  }

  async trialBalance(institutionId: string, from?: Date, to?: Date) {
    await this.ensureInstitutionChart(institutionId);
    const rows = await this.prisma.financeGlJournalLine.groupBy({
      by: ['accountCode'],
      where: {
        institutionId,
        ...(from || to
          ? {
              postedAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      _sum: { debit: true, credit: true },
    });
    return {
      from: from?.toISOString() ?? null,
      to: to?.toISOString() ?? null,
      accounts: rows.map((r) => ({
        accountCode: r.accountCode,
        totalDebit: Number(r._sum.debit ?? 0),
        totalCredit: Number(r._sum.credit ?? 0),
        net: Number(r._sum.debit ?? 0) - Number(r._sum.credit ?? 0),
      })),
    };
  }
}
