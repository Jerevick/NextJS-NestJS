import { financeReportToPdfBuffer } from './finance-report-pdf.util';

export type FinanceReceiptContent = {
  institutionName?: string;
  studentNumber: string;
  studentName?: string;
  reference: string;
  type: string;
  amount: number;
  currency: string;
  description: string;
  processedAt: string;
  paymentMethod?: string | null;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function financeReceiptHtml(content: FinanceReceiptContent): string {
  const inst = content.institutionName ? `<p>${escapeHtml(content.institutionName)}</p>` : '';
  const method = content.paymentMethod
    ? `<tr><td>Method</td><td>${escapeHtml(content.paymentMethod)}</td></tr>`
    : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    body{font-family:system-ui,sans-serif;color:#0f172a;padding:48px}
    h1{font-size:1.4rem;margin:0 0 8px}
    table{width:100%;border-collapse:collapse;margin-top:24px}
    td{padding:8px 0;border-bottom:1px solid #e2e8f0}
    td:first-child{color:#64748b;width:140px}
  </style></head><body>
    <h1>Payment receipt</h1>
    ${inst}
    <table>
      <tr><td>Student</td><td>${escapeHtml(content.studentName ?? '—')} (#${escapeHtml(content.studentNumber)})</td></tr>
      <tr><td>Reference</td><td>${escapeHtml(content.reference)}</td></tr>
      <tr><td>Type</td><td>${escapeHtml(content.type)}</td></tr>
      <tr><td>Amount</td><td>${escapeHtml(content.currency)} ${Math.abs(content.amount).toFixed(2)}</td></tr>
      <tr><td>Description</td><td>${escapeHtml(content.description)}</td></tr>
      ${method}
      <tr><td>Date</td><td>${escapeHtml(new Date(content.processedAt).toLocaleString())}</td></tr>
    </table>
  </body></html>`;
}

/** Prompt 9.1 — receipt PDF via Puppeteer (matches revenue report pipeline). */
export async function financeReceiptToPdfBuffer(content: FinanceReceiptContent): Promise<Buffer> {
  return financeReportToPdfBuffer(financeReceiptHtml(content));
}
