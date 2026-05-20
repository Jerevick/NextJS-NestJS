import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export type SmtpTransportConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
};

@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);

  private transporterFromConfig(config: SmtpTransportConfig): nodemailer.Transporter {
    return nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined,
    });
  }

  private platformConfig(): SmtpTransportConfig | null {
    const host = process.env.SMTP_HOST?.trim();
    if (!host) {
      return null;
    }
    const port = Number(process.env.SMTP_PORT ?? '587');
    const secure = process.env.SMTP_SECURE === '1' || port === 465;
    return {
      host,
      port,
      secure,
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      from: process.env.SMTP_FROM?.trim() ?? 'noreply@unicore.local',
    };
  }

  private transporter(): nodemailer.Transporter | null {
    const cfg = this.platformConfig();
    return cfg ? this.transporterFromConfig(cfg) : null;
  }

  /** Institution SMTP override (Phase 14.1 email channel). */
  async sendWithConfig(
    config: SmtpTransportConfig,
    to: string,
    subject: string,
    text: string,
    html?: string,
    attachments?: Array<{ filename: string; content: Buffer }>,
  ): Promise<void> {
    const transport = this.transporterFromConfig(config);
    await transport.sendMail({
      from: config.from,
      to,
      subject,
      text,
      html: html ?? `<pre>${text}</pre>`,
      attachments,
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
