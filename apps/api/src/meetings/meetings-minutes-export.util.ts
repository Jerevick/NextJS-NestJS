import { Document, Packer, Paragraph, TextRun } from 'docx';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 50;

export async function meetingMinutesToPdfBuffer(
  title: string,
  plainText: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const drawBold = (text: string, size = 14) => {
    page.drawText(text, { x: MARGIN, y, size, font: bold, maxWidth: PAGE_W - 2 * MARGIN });
    y -= size + 12;
  };

  const drawLine = (text: string, size = 10) => {
    const lines = wrapText(text, 90);
    for (const line of lines) {
      if (y < MARGIN + 20) {
        page = doc.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MARGIN;
      }
      page.drawText(line, { x: MARGIN, y, size, font, maxWidth: PAGE_W - 2 * MARGIN });
      y -= size + 4;
    }
  };

  drawBold(title);
  for (const paragraph of plainText.split(/\n{2,}/)) {
    for (const line of paragraph.split('\n')) {
      drawLine(line.trim() || ' ');
    }
    y -= 6;
  }

  return doc.save();
}

export async function meetingMinutesToDocxBuffer(
  title: string,
  plainText: string,
): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 32 })],
    }),
    new Paragraph({ children: [] }),
    ...plainText.split('\n').map(
      (line) =>
        new Paragraph({
          children: [new TextRun({ text: line || ' ', size: 22 })],
        }),
    ),
  ];
  const doc = new Document({
    sections: [{ properties: {}, children }],
  });
  return Packer.toBuffer(doc);
}

/** Legacy RTF fallback. */
export function meetingMinutesToRtfBuffer(title: string, plainText: string): Buffer {
  const escaped = `${title}\n\n${plainText}`
    .replace(/\\/g, '\\\\')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/\n/g, '\\par\n');
  const rtf = `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0\\fswiss Arial;}}\\f0\\fs24 ${escaped}}`;
  return Buffer.from(rtf, 'utf8');
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const next = current ? `${current} ${w}` : w;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = w;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}
