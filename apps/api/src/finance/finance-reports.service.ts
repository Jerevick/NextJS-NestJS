import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { AuthUser } from '../auth/auth.types';
import { FinanceReportScopeService } from './finance-report-scope.service';
import { FinanceRepository } from './finance.repository';
import { feeCodeFromChargeReference } from './finance.util';
import { financeReportToPdfBuffer, revenueReportHtml } from './finance-report-pdf.util';

@Injectable()
export class FinanceReportsService {
  constructor(
    private readonly repo: FinanceRepository,
    private readonly reportScope: FinanceReportScopeService,
  ) {}

  async buildRevenueBreakdown(
    actor: AuthUser,
    fromIso?: string,
    toIso?: string,
    filters?: { programmeId?: string; departmentId?: string },
  ) {
    const scope = await this.reportScope.resolve(actor, filters);
    if (scope.empty) {
      return this.emptyRevenueReport(fromIso, toIso);
    }

    const to = toIso ? new Date(toIso) : new Date();
    const from = fromIso ? new Date(fromIso) : new Date(to.getTime() - 90 * 86_400_000);
    const rows = await this.repo.revenueTransactions(
      actor.institutionId,
      from,
      to,
      scope.entityId,
      scope.programmeId ?? filters?.programmeId,
      scope.departmentIds,
    );

    const byType: Record<string, number> = {};
    const byMethod: Record<string, number> = {};
    const byProgrammeMap = new Map<
      string,
      { programmeId: string; programmeName: string; total: number }
    >();
    const byFeeTypeMap = new Map<string, number>();

    for (const r of rows) {
      const amt = Number(r.amount);
      byType[r.type] = (byType[r.type] ?? 0) + amt;
      if (r.paymentMethod) {
        byMethod[r.paymentMethod] = (byMethod[r.paymentMethod] ?? 0) + amt;
      }
      if (r.type === 'CHARGE' || r.type === 'ADJUSTMENT') {
        const feeCode = feeCodeFromChargeReference(r.reference) ?? r.description.slice(0, 40);
        byFeeTypeMap.set(feeCode, (byFeeTypeMap.get(feeCode) ?? 0) + amt);
      }
      const prog = r.studentAccount.student.program;
      if (prog) {
        const cur = byProgrammeMap.get(prog.id) ?? {
          programmeId: prog.id,
          programmeName: prog.name,
          total: 0,
        };
        cur.total += amt;
        byProgrammeMap.set(prog.id, cur);
      }
    }

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      transactionCount: rows.length,
      byType,
      byMethod,
      byProgramme: [...byProgrammeMap.values()].sort((a, b) => b.total - a.total),
      byFeeType: [...byFeeTypeMap.entries()]
        .map(([feeCode, total]) => ({ feeCode, total }))
        .sort((a, b) => b.total - a.total),
    };
  }

  async exportRevenueExcel(
    actor: AuthUser,
    fromIso?: string,
    toIso?: string,
    filters?: { programmeId?: string; departmentId?: string },
  ): Promise<Buffer> {
    const report = await this.buildRevenueBreakdown(actor, fromIso, toIso, filters);
    const wb = new ExcelJS.Workbook();
    const summary = wb.addWorksheet('Summary');
    summary.addRow(['From', report.from]);
    summary.addRow(['To', report.to]);
    summary.addRow(['Transactions', report.transactionCount]);
    summary.addRow([]);
    summary.addRow(['Type', 'Amount']);
    for (const [k, v] of Object.entries(report.byType)) {
      summary.addRow([k, v]);
    }

    const prog = wb.addWorksheet('By programme');
    prog.addRow(['Programme', 'Amount']);
    for (const p of report.byProgramme) {
      prog.addRow([p.programmeName, p.total]);
    }

    const fees = wb.addWorksheet('By fee type');
    fees.addRow(['Fee code', 'Amount']);
    for (const f of report.byFeeType) {
      fees.addRow([f.feeCode, f.total]);
    }

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  async exportRevenuePdf(
    actor: AuthUser,
    fromIso?: string,
    toIso?: string,
    filters?: { programmeId?: string; departmentId?: string },
  ): Promise<Buffer> {
    const report = await this.buildRevenueBreakdown(actor, fromIso, toIso, filters);
    const institution = await this.repo.findInstitutionName(actor.institutionId);
    const html = revenueReportHtml({
      institutionName: institution?.name,
      from: report.from,
      to: report.to,
      byType: report.byType,
      byProgramme: report.byProgramme,
      byFeeType: report.byFeeType,
    });
    return financeReportToPdfBuffer(html);
  }

  private emptyRevenueReport(fromIso?: string, toIso?: string) {
    const to = toIso ? new Date(toIso) : new Date();
    const from = fromIso ? new Date(fromIso) : new Date(to.getTime() - 90 * 86_400_000);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      transactionCount: 0,
      byType: {} as Record<string, number>,
      byMethod: {} as Record<string, number>,
      byProgramme: [] as Array<{ programmeId: string; programmeName: string; total: number }>,
      byFeeType: [] as Array<{ feeCode: string; total: number }>,
    };
  }
}
