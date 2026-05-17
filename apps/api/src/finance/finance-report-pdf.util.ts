import type { Browser } from 'puppeteer';
import puppeteer from 'puppeteer';

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browserPromise;
}

export async function financeReportToPdfBuffer(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

export function revenueReportHtml(args: {
  institutionName?: string | null;
  from: string;
  to: string;
  byType: Record<string, number>;
  byProgramme: Array<{ programmeId: string; programmeName: string; total: number }>;
  byFeeType: Array<{ feeCode: string; total: number }>;
}): string {
  const progRows = args.byProgramme
    .map(
      (p) =>
        `<tr><td>${escapeHtml(p.programmeName)}</td><td style="text-align:right">${p.total.toFixed(2)}</td></tr>`,
    )
    .join('');
  const feeRows = args.byFeeType
    .map(
      (f) =>
        `<tr><td>${escapeHtml(f.feeCode)}</td><td style="text-align:right">${f.total.toFixed(2)}</td></tr>`,
    )
    .join('');
  const typeRows = Object.entries(args.byType)
    .map(
      ([k, v]) =>
        `<tr><td>${escapeHtml(k)}</td><td style="text-align:right">${v.toFixed(2)}</td></tr>`,
    )
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    body{font-family:system-ui,sans-serif;color:#0f172a;padding:24px}
    h1{font-size:1.25rem} table{width:100%;border-collapse:collapse;margin:1rem 0}
    th,td{border:1px solid #e2e8f0;padding:8px} th{background:#f1f5f9;text-align:left}
  </style></head><body>
    <h1>Revenue report${args.institutionName ? ` · ${escapeHtml(args.institutionName)}` : ''}</h1>
    <p>${escapeHtml(args.from)} — ${escapeHtml(args.to)}</p>
    <h2>By transaction type</h2><table><thead><tr><th>Type</th><th>Amount</th></tr></thead><tbody>${typeRows}</tbody></table>
    <h2>By programme</h2><table><thead><tr><th>Programme</th><th>Revenue</th></tr></thead><tbody>${progRows || '<tr><td colspan="2">—</td></tr>'}</tbody></table>
    <h2>By fee type</h2><table><thead><tr><th>Fee code</th><th>Revenue</th></tr></thead><tbody>${feeRows || '<tr><td colspan="2">—</td></tr>'}</tbody></table>
  </body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
