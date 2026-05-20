import type { AuthUser } from '../auth/auth.types';
import type { AuthRegistrationService } from '../auth/auth-registration.service';
import type { MailService } from '../mail/mail.service';
import type { NotificationEventsService } from '../notifications/notification-events.service';
import type { PrismaService } from '../prisma/prisma.service';
import { RegistrationReviewService } from './registration-review.service';

function buildService(overrides?: {
  request?: unknown;
  peers?: Array<{ id: string }>;
  failNotify?: boolean;
  failMail?: boolean;
}) {
  const findUnique = jest.fn().mockResolvedValue(
    overrides?.request ?? {
      id: 'req_123',
      email: 'ada@northbridge.edu',
      payload: {
        institutionName: 'Northbridge University',
        contact: {
          fullName: 'Ada Lovelace',
          email: 'ada@northbridge.edu',
        },
      },
    },
  );
  const peerFindMany = jest.fn().mockResolvedValue(overrides?.peers ?? [{ id: 'peer_1' }]);

  const prisma = {
    registrationRequest: { findUnique },
    user: { findMany: peerFindMany },
  } as unknown as PrismaService;

  const reviewRegistrationRequest = jest
    .fn()
    .mockResolvedValue({ id: 'req_123', status: 'REVIEWED' });
  const registration = {
    reviewRegistrationRequest,
  } as unknown as AuthRegistrationService;

  const notifyDecision = jest.fn().mockImplementation(async () => {
    if (overrides?.failNotify) {
      throw new Error('notify boom');
    }
  });
  const events = {
    notifyRegistrationDecision: notifyDecision,
  } as unknown as NotificationEventsService;

  const sendEmail = jest.fn().mockImplementation(async () => {
    if (overrides?.failMail) {
      throw new Error('mail boom');
    }
  });
  const mail = { sendEmail } as unknown as MailService;

  const service = new RegistrationReviewService(prisma, registration, events, mail);
  return {
    service,
    findUnique,
    peerFindMany,
    reviewRegistrationRequest,
    notifyDecision,
    sendEmail,
  };
}

const actor: AuthUser = {
  userId: 'usr_super',
  email: 'super@unicore.test',
  role: 'SUPER_ADMIN',
  institutionId: 'inst_platform',
  entityId: '',
  entityScope: 'ALL',
  permissions: ['*'],
};

describe('RegistrationReviewService.review', () => {
  it('persists status, notifies peer super-admins, and emails the institution contact', async () => {
    const {
      service,
      findUnique,
      peerFindMany,
      reviewRegistrationRequest,
      notifyDecision,
      sendEmail,
    } = buildService();

    const updated = await service.review(actor, 'req_123', 'REVIEWED');

    expect(updated).toMatchObject({ id: 'req_123', status: 'REVIEWED' });
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'req_123' } });
    expect(reviewRegistrationRequest).toHaveBeenCalledWith('req_123', 'REVIEWED');

    expect(peerFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          institutionId: 'inst_platform',
          role: 'SUPER_ADMIN',
          NOT: { id: 'usr_super' },
        }),
      }),
    );

    expect(notifyDecision).toHaveBeenCalledTimes(1);
    expect(notifyDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        institutionId: 'inst_platform',
        requestId: 'req_123',
        institutionName: 'Northbridge University',
        contactName: 'Ada Lovelace',
        contactEmail: 'ada@northbridge.edu',
        decision: 'REVIEWED',
        reviewerUserId: 'usr_super',
        reviewerName: 'super@unicore.test',
        additionalRecipientUserIds: ['peer_1'],
      }),
    );

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [to, subject, text] = sendEmail.mock.calls[0] as [string, string, string, string];
    expect(to).toBe('ada@northbridge.edu');
    expect(subject).toMatch(/under review/i);
    expect(text).toContain('req_123');
    expect(text).toContain('Northbridge University');
  });

  it('uses the dismissal email copy when status is DISMISSED', async () => {
    const { service, sendEmail, notifyDecision } = buildService();
    await service.review(actor, 'req_123', 'DISMISSED');

    expect(notifyDecision).toHaveBeenCalledWith(expect.objectContaining({ decision: 'DISMISSED' }));
    const [, subject] = sendEmail.mock.calls[0] as [string, string, string, string];
    expect(subject).toMatch(/Update on your UniCore onboarding/i);
  });

  it('throws BadRequest when the request is not found', async () => {
    const { service, reviewRegistrationRequest, notifyDecision, sendEmail } = buildService({
      request: null,
    });
    await expect(service.review(actor, 'missing', 'REVIEWED')).rejects.toThrow(/not found/i);
    expect(reviewRegistrationRequest).not.toHaveBeenCalled();
    expect(notifyDecision).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('skips notification but still emails when the notification engine throws', async () => {
    const { service, notifyDecision, sendEmail } = buildService({ failNotify: true });
    await expect(service.review(actor, 'req_123', 'REVIEWED')).resolves.toBeDefined();
    expect(notifyDecision).toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalled();
  });

  it('still resolves when the mail transport fails', async () => {
    const { service, notifyDecision, sendEmail } = buildService({ failMail: true });
    await expect(service.review(actor, 'req_123', 'REVIEWED')).resolves.toBeDefined();
    expect(notifyDecision).toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalled();
  });

  it('skips external email when contact email is missing or invalid', async () => {
    const { service, sendEmail } = buildService({
      request: {
        id: 'req_123',
        email: 'not-an-email',
        payload: { institutionName: 'X', contact: {} },
      },
    });
    await service.review(actor, 'req_123', 'REVIEWED');
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
