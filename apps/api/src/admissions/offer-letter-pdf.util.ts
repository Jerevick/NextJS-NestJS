import { Logger } from '@nestjs/common';
import type { Browser } from 'puppeteer';
import puppeteer from 'puppeteer';

const log = new Logger('OfferLetterPdf');

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
    browserPromise = puppeteer.launch({
      headless: true,
      executablePath: executablePath || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }
  return browserPromise;
}

/**
 * Renders full HTML (with inline styles) to a single-page A4 PDF using headless Chromium.
 */
export async function htmlOfferLetterToPdfBuffer(html: string): Promise<Uint8Array> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load', timeout: 45_000 });
    const buf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', right: '16mm', bottom: '18mm', left: '16mm' },
    });
    return new Uint8Array(buf);
  } catch (e) {
    log.warn(e instanceof Error ? e.message : String(e));
    throw e;
  } finally {
    await page.close().catch(() => undefined);
  }
}
