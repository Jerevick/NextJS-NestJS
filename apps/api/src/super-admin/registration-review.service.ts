import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { AuthRegistrationService } from '../auth/auth-registration.service';
import { MailService } from '../mail/mail.service';
import { NotificationEventsService } from '../notifications/notification-events.service';
import { PrismaService } from '../prisma/prisma.service';

type RegistrationReviewDecision = 'REVIEWED' | 'DISMISSED';

type RegistrationPayloadShape = {
  institutionName?: string;
  institutionEmail?: string;
  contact?: { fullName?: string; firstName?: string; lastName?: string; email?: string };
};

function uniqueValidEmails(...emails: Array<string | undefined>): string[] {
  return Array.from(
    new Set(
      emails
        .map((email) => email?.trim().toLowerCase())
        .filter((email): email is string => Boolean(email && email.includes('@'))),
    ),
  );
}

/**
 * Phase 1 hand-off after a super-admin reviews an institution onboarding submission.
 * - Persists the new status via `AuthRegistrationService`
 * - Emits an in-app/email notification to the acting super-admin and peers
 * - Sends an external acknowledgement email to the prospective institution contact
 */
@Injectable()
export class RegistrationReviewService {
  private readonly log = new Logger(RegistrationReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registration: AuthRegistrationService,
    private readonly events: NotificationEventsService,
    private readonly mail: MailService,
  ) {}

  async review(actor: AuthUser, requestId: string, decision: RegistrationReviewDecision) {
    const existing = await this.prisma.registrationRequest.findUnique({
      where: { id: requestId },
    });
    if (!existing) {
      throw new BadRequestException('Request not found');
    }

    const updated = await this.registration.reviewRegistrationRequest(requestId, decision);
    const payload = (existing.payload ?? {}) as RegistrationPayloadShape;
    const institutionName = payload.institutionName?.trim() || 'Untitled institution';
    const contactName =
      payload.contact?.fullName?.trim() ||
      [payload.contact?.firstName, payload.contact?.lastName].filter(Boolean).join(' ').trim() ||
      existing.email;
    const contactEmail = (payload.contact?.email ?? existing.email).trim().toLowerCase();
    const institutionEmail = payload.institutionEmail?.trim().toLowerCase();
    const reviewerName = actor.email ?? actor.userId;

    const peerUserIds = await this.findPeerSuperAdminUserIds(actor.institutionId, actor.userId);

    try {
      await this.events.notifyRegistrationDecision({
        institutionId: actor.institutionId,
        entityId: actor.entityId ?? null,
        requestId,
        institutionName,
        contactName,
        contactEmail,
        decision,
        reviewerUserId: actor.userId,
        reviewerName,
        additionalRecipientUserIds: peerUserIds,
      });
    } catch (err) {
      this.log.warn(
        `In-app notification for registration ${requestId} (${decision}) failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    try {
      await this.sendExternalAcknowledgement({
        toEmails: uniqueValidEmails(contactEmail, institutionEmail, existing.email),
        contactName,
        institutionName,
        requestId,
        decision,
      });
    } catch (err) {
      this.log.warn(
        `External acknowledgement email for ${requestId} (${decision}) failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    return updated;
  }

  private async findPeerSuperAdminUserIds(
    institutionId: string,
    excludeUserId: string,
  ): Promise<string[]> {
    const peers = await this.prisma.user.findMany({
      where: {
        institutionId,
        role: 'SUPER_ADMIN',
        deletedAt: null,
        isActive: true,
        NOT: { id: excludeUserId },
      },
      select: { id: true },
      take: 50,
    });
    return peers.map((p) => p.id);
  }

  private async sendExternalAcknowledgement(args: {
    toEmails: string[];
    contactName: string;
    institutionName: string;
    requestId: string;
    decision: RegistrationReviewDecision;
  }): Promise<void> {
    if (args.toEmails.length === 0) {
      return;
    }
    const isApproved = args.decision === 'REVIEWED';
    const subject = isApproved
      ? `Your UniCore onboarding request is under review`
      : `Update on your UniCore onboarding request`;
    const lead = isApproved
      ? `Thank you, ${args.contactName}. Your onboarding request for ${args.institutionName} has been reviewed by our platform team and is moving forward. We will be in touch shortly to schedule provisioning, billing setup, and your first administrator account.`
      : `Thank you, ${args.contactName}. After reviewing your onboarding request for ${args.institutionName}, our platform team is unable to proceed at this time. Please reply to this email if you would like to provide additional information or revisit your submission.`;
    const text = [lead, '', `Reference: ${args.requestId}`, '', '— The UniCore platform team'].join(
      '\n',
    );
    const html = `<p>${lead}</p><p><strong>Reference</strong> <code>${args.requestId}</code></p><p>— The UniCore platform team</p>`;
    await Promise.all(
      args.toEmails.map((email) => this.mail.sendEmail(email, subject, text, html)),
    );
  }
}
