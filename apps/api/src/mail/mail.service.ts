import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);

  private transporter(): nodemailer.Transporter | null {
    const host = process.env.SMTP_HOST?.trim();
    if (!host) {
      return null;
    }
    const port = Number(process.env.SMTP_PORT ?? '587');
    const secure = process.env.SMTP_SECURE === '1' || port === 465;
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });
  }

  async sendMagicLink(to: string, subject: string, text: string, html?: string): Promise<void> {
    await this.sendEmail(to, subject, text, html);
  }

  async sendEmail(
    to: string,
    subject: string,
    text: string,
    html?: string,
    attachments?: Array<{ filename: string; content: Buffer }>,
  ): Promise<void> {
    const from = process.env.SMTP_FROM?.trim() ?? 'noreply@unicore.local';
    const transport = this.transporter();
    if (!transport) {
      this.log.warn(`Email (no SMTP_HOST). To: ${to} · ${subject}\n${text}`);
      return;
    }
    await transport.sendMail({
      from,
      to,
      subject,
      text,
      html: html ?? `<pre>${text}</pre>`,
      attachments,
    });
  }
}
