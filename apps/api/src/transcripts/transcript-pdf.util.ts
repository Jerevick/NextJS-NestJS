import { PDFDocument, StandardFonts } from 'pdf-lib';

export type TranscriptPdfContent = {
  student: {
    studentNumber?: string;
    email?: string;
    program?: { code?: string; name?: string };
    name?: { firstName?: string; lastName?: string };
    admissionDate?: string | null;
    expectedGraduationDate?: string | null;
  };
  lines?: Array<{
    course?: { code?: string; title?: string; creditHours?: number };
    semester?: { name?: string };
    grade?: {
      letterGrade?: string | null;
      score?: number | null;
      gradePoints?: number | null;
      workflowStatus?: string | null;
    };
    status?: string;
  }>;
  summary?: { cumulativeGpa?: number | null; gpaCreditHours?: number; lineCount?: number };
};

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 50;

export async function transcriptContentToPdfBuffer(
  content: TranscriptPdfContent,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const needSpace = (n: number) => {
    if (y - n < MARGIN + 30) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };

  function drawBold(text: string, size = 13) {
    needSpace(size + 14);
    page.drawText(text, { x: MARGIN, y, size, font: bold, maxWidth: PAGE_W - 2 * MARGIN });
    y -= size + 10;
  }

  function drawText(text: string, size = 10) {
    needSpace(size + 6);
    page.drawText(text, { x: MARGIN, y, size, font, maxWidth: PAGE_W - 2 * MARGIN });
    y -= size + 4;
  }

  drawBold('UniCore academic transcript');

  const s = content.student ?? {};
  const pn = `${s.name?.firstName ?? ''} ${s.name?.lastName ?? ''}`.trim();
  drawText(`Student: ${pn || '—'} · ID: ${String(s.studentNumber ?? '—')}`);
  drawText(`Email: ${String(s.email ?? '—')}`);
  const progCode = String(s.program?.code ?? '').trim();
  const progName = String(s.program?.name ?? '').trim();
  drawText(`Program: ${progCode}${progCode && progName ? ' — ' : ''}${progName}`);
  if (s.admissionDate) {
    try {
      drawText(`Admission: ${new Date(s.admissionDate).toLocaleDateString()}`);
    } catch {
      drawText(`Admission: ${s.admissionDate}`);
    }
  }

  drawBold('Course summary', 12);
  for (const line of content.lines ?? []) {
    const code = line.course?.code ?? '—';
    const title = (line.course?.title ?? '').slice(0, 64);
    const cr = typeof line.course?.creditHours === 'number' ? line.course.creditHours : 0;
    const sem = line.semester?.name ?? '';
    const g = line.grade?.letterGrade ?? '—';
    const pts =
      typeof line.grade?.gradePoints === 'number' && Number.isFinite(line.grade.gradePoints)
        ? String(line.grade.gradePoints)
        : '—';
    drawText(
      `${code} (${cr} CH) · ${sem} · ${line.status ?? '—'} · ${String(g)} (pts ${pts}) · ${title}`,
      8,
    );
  }

  const sum = content.summary ?? {};
  drawBold('Totals', 12);
  drawText(
    `Cumulative GPA: ${sum.cumulativeGpa !== undefined && sum.cumulativeGpa !== null ? String(sum.cumulativeGpa) : '—'} · Graded credits: ${String(sum.gpaCreditHours ?? 0)}`,
  );
  drawText(`Generated UTC: ${new Date().toUTCString()}`, 8);

  drawText('Registrar-of-record reconciliation may be required before official use.', 7);

  return doc.save();
}
