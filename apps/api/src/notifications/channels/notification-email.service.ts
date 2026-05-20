import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  readNotificationSettings,
  type InstitutionSmtpSettings,
} from '../notification-channel-settings.util';

@Injectable()
export class NotificationEmailService {
  private readonly log = new Logger(NotificationEmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /** nodemailer + Handlebars HTML — institution SMTP, else platform SMTP env. */
  async send(
    institutionId: string,
    to: string,
    subject: string,
    text: string,
    html?: string,
    attachments?: Array<{ filename: string; content: Buffer }>,
  ): Promise<void> {
    const inst = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: { settings: true, name: true },
    });
    const channel = readNotificationSettings(inst?.settings);
    const smtp = channel.smtp ?? this.platformSmtp();
    if (!smtp) {
      await this.mail.sendEmail(to, subject, text, html, attachments);
      return;
    }
    const from =
      smtp.from?.trim() ??
      process.env.SMTP_FROM?.trim() ??
      `noreply@${institutionId.slice(0, 8)}.unicore.local`;
    await this.mail.sendWithConfig(
      {
        host: smtp.host,
        port: smtp.port ?? 587,
        secure: smtp.secure ?? false,
        user: smtp.user,
        pass: smtp.pass,
        from,
      },
      to,
      subject,
      text,
      html,
      attachments,
    );
    this.log.debug(`Email sent via institution SMTP for ${institutionId}`);
  }

  private platformSmtp(): InstitutionSmtpSettings | null {
    const host = process.env.SMTP_HOST?.trim();
    if (!host) return null;
    return {
      host,
      port: Number(process.env.SMTP_PORT ?? '587'),
      secure: process.env.SMTP_SECURE === '1',
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      from: process.env.SMTP_FROM,
    };
  }
}
