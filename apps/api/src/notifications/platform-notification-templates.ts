import type { NotificationChannelsConfig } from './notification.types';

export type PlatformTemplateDef = {
  event: string;
  channels: NotificationChannelsConfig;
  subject: string;
  htmlBody: string;
  textBody: string;
};

/** UniCore platform defaults (lowest cascade priority). */
export const PLATFORM_NOTIFICATION_TEMPLATES: PlatformTemplateDef[] = [
  {
    event: 'GRADE_RELEASED',
    channels: { email: true, inApp: true },
    subject: 'Grades released — {{courseName}}',
    htmlBody:
      '<p>Hello {{studentName}},</p><p>Your grades for <strong>{{courseName}}</strong> have been released.</p>',
    textBody: 'Hello {{studentName}}, your grades for {{courseName}} have been released.',
  },
  {
    event: 'STATUS_CHANGED',
    channels: { email: true, inApp: true },
    subject: 'Student status update — {{studentNumber}}',
    htmlBody:
      '<p>Student <strong>{{studentName}}</strong> ({{studentNumber}}) status changed to {{newStatus}}.</p>',
    textBody: 'Student {{studentName}} ({{studentNumber}}) status changed to {{newStatus}}.',
  },
  {
    event: 'FEE_DUE',
    channels: { email: true, inApp: true, push: true, sms: true },
    subject: 'Fee reminder — {{amount}} due {{dueDate}}',
    htmlBody:
      '<p>A fee of <strong>{{amount}}</strong> is due on {{dueDate}} ({{daysBefore}}-day reminder).</p>',
    textBody: 'A fee of {{amount}} is due on {{dueDate}}.',
  },
  {
    event: 'WORKFLOW_ACTION_ASSIGNED',
    channels: { inApp: true, email: true },
    subject: 'Action required — {{workflowName}}',
    htmlBody: '<p>You have a pending approval: <strong>{{workflowName}}</strong>.</p>',
    textBody: 'You have a pending approval: {{workflowName}}.',
  },
  {
    event: 'WORKFLOW_SLA_WARNING',
    channels: { inApp: true, email: true },
    subject: 'SLA warning — {{workflowName}}',
    htmlBody: '<p>Workflow <strong>{{workflowName}}</strong> is approaching its SLA deadline.</p>',
    textBody: 'Workflow {{workflowName}} is approaching its SLA deadline.',
  },
  {
    event: 'DOCUMENT_READY',
    channels: { inApp: true, email: true },
    subject: 'Document ready — {{documentName}}',
    htmlBody: '<p>Your document <strong>{{documentName}}</strong> is ready to download.</p>',
    textBody: 'Your document {{documentName}} is ready to download.',
  },
  {
    event: 'ELECTION_VOTING_OPEN',
    channels: { inApp: true, email: true, push: true },
    subject: 'Voting open — {{electionTitle}}',
    htmlBody:
      '<p>Voting is now open for <strong>{{electionTitle}}</strong>. Cast your ballot before the deadline.</p>',
    textBody: 'Voting is now open for {{electionTitle}}. Cast your ballot before the deadline.',
  },
  {
    event: 'BACKFILL_APPROVED',
    channels: { inApp: true, email: true },
    subject: 'Backfill request approved',
    htmlBody:
      '<p>Backfill request <strong>{{requestId}}</strong> was approved. Billing may be affected.</p>',
    textBody: 'Backfill request {{requestId}} was approved. Billing may be affected.',
  },
  {
    event: 'FINANCE_TRANSACTION',
    channels: { inApp: true, email: false },
    subject: 'Finance update — {{reference}}',
    htmlBody: '<p>{{message}}</p>',
    textBody: '{{message}}',
  },
  {
    event: 'FINANCE_PAYMENT_RECEIVED',
    channels: { inApp: true, push: true, sms: true },
    subject: 'Payment received — {{reference}}',
    htmlBody: '<p>Your payment of <strong>{{amountLabel}}</strong> was received. {{message}}</p>',
    textBody: 'Payment received ({{reference}}): {{message}}',
  },
  {
    event: 'FINANCE_PAYMENT_RECEIPT',
    channels: { email: true, inApp: false },
    subject: 'Receipt · {{reference}}',
    htmlBody:
      '<p>Hello {{studentName}},</p><p>Your payment ({{reference}}) of <strong>{{amountLabel}}</strong> is attached as a PDF.</p><p>{{description}}</p>',
    textBody:
      'Hello {{studentName}},\n\nYour payment ({{reference}}) of {{amountLabel}} is attached.\n\n{{description}}',
  },
  {
    event: 'FINANCE_REFUND_RECEIVED',
    channels: { inApp: true, push: true, sms: true },
    subject: 'Refund processed — {{reference}}',
    htmlBody: '<p>A refund of <strong>{{amountLabel}}</strong> was posted. {{message}}</p>',
    textBody: 'Refund processed ({{reference}}): {{message}}',
  },
  {
    event: 'FINANCE_SCHOLARSHIP_CREDIT',
    channels: { inApp: true, push: true },
    subject: 'Scholarship credit — {{reference}}',
    htmlBody: '<p>Scholarship credit applied: <strong>{{amountLabel}}</strong>. {{message}}</p>',
    textBody: 'Scholarship credit ({{reference}}): {{message}}',
  },
  {
    event: 'FINANCE_CHARGE_POSTED',
    channels: { inApp: true, push: true },
    subject: 'New charge — {{reference}}',
    htmlBody: '<p>A charge of <strong>{{amountLabel}}</strong> was posted. {{message}}</p>',
    textBody: 'New charge ({{reference}}): {{message}}',
  },
  {
    event: 'MEETING_ACTION_DUE',
    channels: { inApp: true, email: true },
    subject: 'Action item due — {{meetingTitle}}',
    htmlBody: '<p><strong>{{description}}</strong> is due {{dueDate}}.</p>',
    textBody: '{{description}} is due {{dueDate}}.',
  },
  {
    event: 'LEAVE_DECISION',
    channels: { inApp: true, email: true },
    subject: 'Leave request {{decision}}',
    htmlBody: '<p>{{body}}</p>',
    textBody: '{{body}}',
  },
  {
    event: 'REGISTRATION_SUBMITTED',
    channels: { inApp: true, email: true },
    subject: 'New institution onboarding — {{institutionName}}',
    htmlBody:
      '<p>A new onboarding request was submitted for <strong>{{institutionName}}</strong> by {{contactName}} ({{contactEmail}}).</p><p><a href="{{actionUrl}}">Open onboarding dossier in UniCore</a></p>',
    textBody:
      'New onboarding request for {{institutionName}} from {{contactName}} ({{contactEmail}}). Review: {{actionUrl}}',
  },
  {
    event: 'REGISTRATION_REVIEWED',
    channels: { inApp: true, email: true },
    subject: 'Registration request reviewed — {{institutionName}}',
    htmlBody:
      '<p>Registration request <strong>{{requestId}}</strong> for <strong>{{institutionName}}</strong> was marked as <strong>reviewed</strong> by {{reviewerName}}.</p><p><a href="{{actionUrl}}">View request in UniCore</a></p>',
    textBody:
      'Registration request {{requestId}} for {{institutionName}} was marked as reviewed by {{reviewerName}}. {{actionUrl}}',
  },
  {
    event: 'REGISTRATION_DISMISSED',
    channels: { inApp: true, email: true },
    subject: 'Registration request dismissed — {{institutionName}}',
    htmlBody:
      '<p>Registration request <strong>{{requestId}}</strong> for <strong>{{institutionName}}</strong> was dismissed by {{reviewerName}}.</p><p><a href="{{actionUrl}}">View request in UniCore</a></p>',
    textBody:
      'Registration request {{requestId}} for {{institutionName}} was dismissed by {{reviewerName}}. {{actionUrl}}',
  },
  {
    event: 'GENERIC',
    channels: { inApp: true },
    subject: '{{title}}',
    htmlBody: '<p>{{body}}</p>',
    textBody: '{{body}}',
  },
];

export function getPlatformTemplate(event: string): PlatformTemplateDef | undefined {
  return PLATFORM_NOTIFICATION_TEMPLATES.find((t) => t.event === event);
}
