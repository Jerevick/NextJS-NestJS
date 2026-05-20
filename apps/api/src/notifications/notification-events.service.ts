import { Injectable, Logger } from '@nestjs/common';
import type { BillingImplication, StudentEnrollmentStatusEnum } from '@prisma/client';
import { NotificationPriority } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationEmailService } from './channels/notification-email.service';
import { NotificationEngineService } from './notification-engine.service';
import { getPlatformTemplate } from './platform-notification-templates';
import { renderTemplate } from './notification-template.util';
import {
  findInstitutionFinanceNotifiers,
  findPositionHolderUserIds,
  parseGuardianContacts,
} from './notification-recipients.util';
import {
  ELECTION_VOTING_OPEN_CHANNELS,
  feeDueChannels,
  feeDuePriority,
} from './notification-event-channels.util';
import type { SendNotificationInput } from './notification.types';

@Injectable()
export class NotificationEventsService {
  private readonly log = new Logger(NotificationEventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: NotificationEngineService,
    private readonly email: NotificationEmailService,
  ) {}

  private webPublicBase(): string {
    return (
      process.env.WEB_PUBLIC_URL?.trim() ??
      process.env.NEXT_PUBLIC_WEB_URL?.trim() ??
      'http://localhost:3000'
    ).replace(/\/$/, '');
  }

  private registrationUrls(requestId: string): { relative: string; absolute: string } {
    const relative = `/admin/registration-requests/${requestId}`;
    return { relative, absolute: `${this.webPublicBase()}${relative}` };
  }

  /** Status GAIN/LOSS → Registrar + Finance (BURSAR). */
  async notifyStatusChangeBillingImpact(args: {
    institutionId: string;
    entityId: string;
    studentId: string;
    studentNumber: string;
    studentName: string;
    fromStatus: StudentEnrollmentStatusEnum;
    toStatus: StudentEnrollmentStatusEnum;
    billingImplication: BillingImplication;
  }): Promise<void> {
    if (args.billingImplication !== 'GAIN' && args.billingImplication !== 'LOSS') {
      return;
    }
    const recipients = await findInstitutionFinanceNotifiers(
      this.prisma,
      args.institutionId,
      args.entityId,
    );
    const newStatus = `${args.toStatus} (${args.billingImplication} billing impact)`;
    const data = {
      studentNumber: args.studentNumber,
      studentName: args.studentName,
      newStatus,
      billingImplication: args.billingImplication,
      fromStatus: args.fromStatus,
      toStatus: args.toStatus,
    };
    for (const recipientId of recipients) {
      await this.safeSend({
        institutionId: args.institutionId,
        entityId: args.entityId,
        recipientId,
        event: 'STATUS_CHANGED',
        data,
        actionUrl: `/students/${args.studentId}`,
        priority: NotificationPriority.HIGH,
      });
    }
  }

  /** Grade released → student. */
  async notifyGradeReleased(args: {
    institutionId: string;
    entityId: string;
    enrollmentId: string;
    studentUserId: string;
    studentName: string;
    courseName: string;
  }): Promise<void> {
    await this.safeSend({
      institutionId: args.institutionId,
      entityId: args.entityId,
      recipientId: args.studentUserId,
      event: 'GRADE_RELEASED',
      data: {
        studentName: args.studentName,
        courseName: args.courseName,
      },
      actionUrl: '/my-grades',
    });
  }

  /** Fee due reminder → student + guardians (7 / 3 / 1 days). */
  async notifyFeeDue(args: {
    institutionId: string;
    entityId: string;
    studentId: string;
    studentUserId: string | null;
    guardians: unknown;
    amount: string;
    dueDate: string;
    daysBefore: 7 | 3 | 1;
    currency?: string;
  }): Promise<void> {
    const data = {
      amount: args.amount,
      dueDate: args.dueDate,
      daysBefore: args.daysBefore,
      currency: args.currency ?? 'USD',
    };
    const channels = feeDueChannels(args.daysBefore);
    const priority = feeDuePriority(args.daysBefore);

    if (args.studentUserId) {
      await this.safeSend({
        institutionId: args.institutionId,
        entityId: args.entityId,
        recipientId: args.studentUserId,
        event: 'FEE_DUE',
        data,
        actionUrl: '/my-finance',
        channels,
        priority,
      });
    }
    for (const g of parseGuardianContacts(args.guardians)) {
      if (g.userId) {
        await this.safeSend({
          institutionId: args.institutionId,
          entityId: args.entityId,
          recipientId: g.userId,
          event: 'FEE_DUE',
          data: { ...data, studentId: args.studentId, guardian: true },
          actionUrl: '/my-finance',
          channels: args.daysBefore === 1 ? ['inApp', 'email', 'sms'] : ['inApp', 'email'],
          priority,
        });
      } else if (g.email) {
        await this.sendGuardianFeeDueEmail(args.institutionId, g.email, data);
      }
    }
  }

  /** Workflow step assigned → assignee. */
  async notifyWorkflowActionAssigned(args: {
    institutionId: string;
    entityId: string;
    assigneeUserId: string;
    workflowName: string;
    workflowInstanceId: string;
  }): Promise<void> {
    await this.safeSend({
      institutionId: args.institutionId,
      entityId: args.entityId,
      recipientId: args.assigneeUserId,
      event: 'WORKFLOW_ACTION_ASSIGNED',
      data: { workflowName: args.workflowName },
      actionUrl: `/workflows/${args.workflowInstanceId}`,
      priority: NotificationPriority.HIGH,
    });
  }

  /** SLA warning → assignee + supervisor (escalation target). */
  async notifyWorkflowSlaWarning(args: {
    institutionId: string;
    entityId: string;
    assigneeUserId: string;
    supervisorUserId?: string | null;
    workflowName: string;
    workflowInstanceId: string;
    dueAt: Date;
  }): Promise<void> {
    const data = {
      workflowName: args.workflowName,
      dueAt: args.dueAt.toISOString(),
    };
    const actionUrl = `/workflows/${args.workflowInstanceId}`;
    await this.safeSend({
      institutionId: args.institutionId,
      entityId: args.entityId,
      recipientId: args.assigneeUserId,
      event: 'WORKFLOW_SLA_WARNING',
      data,
      actionUrl,
      priority: NotificationPriority.HIGH,
    });
    if (args.supervisorUserId && args.supervisorUserId !== args.assigneeUserId) {
      await this.safeSend({
        institutionId: args.institutionId,
        entityId: args.entityId,
        recipientId: args.supervisorUserId,
        event: 'WORKFLOW_SLA_WARNING',
        data: { ...data, supervisor: true },
        actionUrl,
        priority: NotificationPriority.HIGH,
      });
    }
  }

  /** Document ready → student owner. */
  async notifyDocumentReady(args: {
    institutionId: string;
    entityId: string | null;
    ownerUserId: string;
    documentName: string;
    documentId: string;
  }): Promise<void> {
    await this.safeSend({
      institutionId: args.institutionId,
      entityId: args.entityId,
      recipientId: args.ownerUserId,
      event: 'DOCUMENT_READY',
      data: { documentName: args.documentName },
      actionUrl: `/documents/${args.documentId}`,
    });
  }

  /** Election voting open → eligible voter. */
  async notifyElectionVotingOpen(args: {
    institutionId: string;
    entityId: string;
    recipientId: string;
    electionTitle: string;
    electionId: string;
  }): Promise<void> {
    await this.safeSend({
      institutionId: args.institutionId,
      entityId: args.entityId,
      recipientId: args.recipientId,
      event: 'ELECTION_VOTING_OPEN',
      data: { electionTitle: args.electionTitle, electionId: args.electionId },
      actionUrl: '/elections',
      channels: ELECTION_VOTING_OPEN_CHANNELS,
      priority: NotificationPriority.HIGH,
    });
  }

  /** New institution registration submitted → all active platform super-admins. */
  async notifyRegistrationSubmitted(args: {
    requestId: string;
    institutionName: string;
    contactName: string;
    contactEmail: string;
  }): Promise<void> {
    const superAdmins = await this.prisma.user.findMany({
      where: { role: 'SUPER_ADMIN', deletedAt: null, isActive: true },
      select: { id: true, institutionId: true },
      take: 50,
    });
    const { relative, absolute } = this.registrationUrls(args.requestId);
    const data = {
      requestId: args.requestId,
      institutionName: args.institutionName,
      contactName: args.contactName,
      contactEmail: args.contactEmail,
      actionUrl: absolute,
    };

    for (const admin of superAdmins) {
      await this.safeSend({
        institutionId: admin.institutionId,
        entityId: null,
        recipientId: admin.id,
        event: 'REGISTRATION_SUBMITTED',
        data,
        actionUrl: relative,
        priority: NotificationPriority.HIGH,
      });
    }
  }

  /**
   * Registration intake review → notifies the acting super-admin and any other
   * platform super administrators on the same institution. Decision events are
   * `REGISTRATION_REVIEWED` (approved for tenant provisioning) or
   * `REGISTRATION_DISMISSED`.
   */
  async notifyRegistrationDecision(args: {
    institutionId: string;
    entityId?: string | null;
    requestId: string;
    institutionName: string;
    contactName: string;
    contactEmail: string;
    decision: 'REVIEWED' | 'DISMISSED';
    reviewerUserId: string;
    reviewerName: string;
    additionalRecipientUserIds?: string[];
  }): Promise<void> {
    const event = args.decision === 'REVIEWED' ? 'REGISTRATION_REVIEWED' : 'REGISTRATION_DISMISSED';
    const { relative, absolute } = this.registrationUrls(args.requestId);
    const data = {
      requestId: args.requestId,
      institutionName: args.institutionName,
      contactName: args.contactName,
      contactEmail: args.contactEmail,
      decision: args.decision,
      reviewerName: args.reviewerName,
      actionUrl: absolute,
    };

    const recipients = new Set<string>([args.reviewerUserId]);
    for (const id of args.additionalRecipientUserIds ?? []) {
      if (id && id !== args.reviewerUserId) {
        recipients.add(id);
      }
    }

    for (const recipientId of recipients) {
      await this.safeSend({
        institutionId: args.institutionId,
        entityId: args.entityId ?? null,
        recipientId,
        event,
        data,
        actionUrl: relative,
        priority:
          args.decision === 'REVIEWED' ? NotificationPriority.NORMAL : NotificationPriority.LOW,
      });
    }
  }

  /** Backfill approved → finance/registrar notifiers. */
  async notifyBackfillApproved(args: {
    institutionId: string;
    entityId: string;
    requestId: string;
    studentNumber?: string;
    retroactiveAmount?: string | null;
  }): Promise<void> {
    const recipients = await findInstitutionFinanceNotifiers(
      this.prisma,
      args.institutionId,
      args.entityId,
    );
    const data = {
      requestId: args.requestId,
      studentNumber: args.studentNumber ?? '',
      retroactiveAmount: args.retroactiveAmount ?? '',
      billingNote: 'Retroactive billing may apply for the approved backfill period.',
    };
    for (const recipientId of recipients) {
      await this.safeSend({
        institutionId: args.institutionId,
        entityId: args.entityId,
        recipientId,
        event: 'BACKFILL_APPROVED',
        data,
        actionUrl: `/billing/backfill/${args.requestId}`,
        priority: NotificationPriority.HIGH,
      });
    }
  }

  private async sendGuardianFeeDueEmail(
    institutionId: string,
    to: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const tpl = getPlatformTemplate('FEE_DUE');
    if (!tpl) return;
    const subject = renderTemplate(tpl.subject, data);
    const text = renderTemplate(tpl.textBody, data);
    const html = renderTemplate(tpl.htmlBody, data);
    try {
      await this.email.send(institutionId, to, subject, text, html);
    } catch (err) {
      this.log.warn(
        `Guardian fee-due email to ${to} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async safeSend(input: SendNotificationInput): Promise<void> {
    try {
      await this.engine.send(input);
    } catch (err) {
      this.log.warn(
        `Notification ${input.event} → ${input.recipientId} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
