/**
 * Registration intake E2E against real PostgreSQL (Testcontainers).
 * Submits a `New institution` registration through `AuthRegistrationService`
 * and asserts that:
 *   - a `RegistrationRequest` row was created with the expected payload
 *   - uploaded files were forwarded to `ObjectStorageService.putBuffer`
 *   - a platform notification email was attempted via `MailService`
 *
 * Skipped automatically when `SKIP_TESTCONTAINERS=1` or Docker is unavailable.
 */
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { TenantModule } from '@prisma/client';
import { AuthRegistrationService } from '../src/auth/auth-registration.service';
import type { NotificationEventsService } from '../src/notifications/notification-events.service';
import type { RegisterInstitutionDto } from '../src/auth/dto/register-institution.dto';
import { PrismaService } from '../src/prisma/prisma.service';
import type { MailService } from '../src/mail/mail.service';
import type { ObjectStorageService } from '../src/storage/object-storage.service';

const runContainers = process.env.SKIP_TESTCONTAINERS !== '1';

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PDF_HEADER = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);

function fakeFile(
  fieldname: string,
  originalname: string,
  mimetype: string,
  buffer: Buffer,
): Express.Multer.File {
  return {
    fieldname,
    originalname,
    encoding: '7bit',
    mimetype,
    size: buffer.length,
    buffer,
    destination: '',
    filename: originalname,
    path: '',
    stream: undefined as unknown as Express.Multer.File['stream'],
  };
}

function fakeRequest(): Parameters<AuthRegistrationService['submitInstitution']>[0] {
  return {
    ip: '203.0.113.42',
    socket: { remoteAddress: '203.0.113.42' },
    headers: { 'user-agent': 'jest-e2e/1.0' },
  } as unknown as Parameters<AuthRegistrationService['submitInstitution']>[0];
}

function validDto(overrides: Partial<RegisterInstitutionDto> = {}): RegisterInstitutionDto {
  return {
    institutionName: 'Northbridge University',
    institutionType: 'university',
    institutionEmail: 'registry@northbridge.edu',
    addressLine1: '1 Campus Drive',
    addressLine2: 'Suite 200',
    city: 'Mountainview',
    stateProvince: 'CA',
    postalCode: '94040',
    country: 'United States',
    accreditationStatus: 'accredited',
    accreditationBody: 'WSCUC',
    accreditationReference: 'ACC-2024-001',
    accreditationValidUntil: '2030-06-30',
    contactFirstName: 'Ada',
    contactLastName: 'Lovelace',
    contactTitle: 'Registrar',
    contactPhone: '+1-555-0100',
    contactEmail: 'ada@northbridge.edu',
    modulesInterested: [TenantModule.SIS, TenantModule.LMS],
    estimatedStudents: '500-2000',
    message: 'Two campuses launching in September.',
    ...overrides,
  };
}

(runContainers ? describe : describe.skip)(
  'AuthRegistrationService.submitInstitution (Testcontainers)',
  () => {
    let container: StartedPostgreSqlContainer;
    let prisma: PrismaService;
    let service: AuthRegistrationService;

    const mailSpy = jest.fn(async () => undefined);
    const notifySubmittedSpy = jest.fn(async () => undefined);
    const putBufferSpy = jest.fn(async (key: string) => ({
      key: `local://${key}`,
      url: `file:///tmp/${key}`,
    }));

    beforeAll(async () => {
      jest.setTimeout(180_000);
      container = await new PostgreSqlContainer('postgres:16-alpine').start();
      const url = container.getConnectionUri();
      process.env.DATABASE_URL = url;
      process.env.PLATFORM_INBOX_EMAIL = 'platform@unicore.test';

      const dbPackage = join(__dirname, '..', '..', '..', 'packages', 'database');
      execSync('pnpm exec prisma db push --skip-generate', {
        cwd: dbPackage,
        env: { ...process.env, DATABASE_URL: url },
        stdio: 'pipe',
      });

      prisma = new PrismaService();

      const mailStub = { sendEmail: mailSpy } as unknown as MailService;
      const storageStub = { putBuffer: putBufferSpy } as unknown as ObjectStorageService;
      const notificationEventsStub = {
        notifyRegistrationSubmitted: notifySubmittedSpy,
      } as unknown as NotificationEventsService;

      service = new AuthRegistrationService(prisma, mailStub, storageStub, notificationEventsStub);
    }, 180_000);

    afterAll(async () => {
      await prisma?.$disconnect();
      await container?.stop();
    });

    afterEach(async () => {
      mailSpy.mockClear();
      notifySubmittedSpy.mockClear();
      putBufferSpy.mockClear();
      await prisma.registrationRequest.deleteMany();
    });

    it('persists a registration request and forwards files to object storage', async () => {
      const dto = validDto();
      const logo = fakeFile(
        'logo',
        'logo.png',
        'image/png',
        Buffer.concat([PNG_HEADER, Buffer.alloc(64, 0x10)]),
      );
      const evidence = fakeFile(
        'accreditationEvidence',
        'accreditation.pdf',
        'application/pdf',
        Buffer.concat([PDF_HEADER, Buffer.alloc(64, 0x20)]),
      );

      const result = await service.submitInstitution(fakeRequest(), dto, {
        logo,
        accreditationEvidence: evidence,
      });

      expect(result.ok).toBe(true);
      expect(typeof result.requestId).toBe('string');
      expect(result.requestId.length).toBeGreaterThan(0);

      const row = await prisma.registrationRequest.findUnique({ where: { id: result.requestId } });
      expect(row).not.toBeNull();
      expect(row?.kind).toBe('NEW_INSTITUTION');
      expect(row?.status).toBe('PENDING');
      expect(row?.email).toBe('ada@northbridge.edu');
      expect(row?.ipAddress).toBe('203.0.113.42');
      expect(row?.userAgent).toBe('jest-e2e/1.0');

      const payload = row?.payload as Record<string, unknown>;
      expect(payload.institutionName).toBe('Northbridge University');
      expect(payload.institutionType).toBe('university');
      expect(payload.country).toBe('United States');
      expect(payload.corePackages).toEqual(['SIS', 'LMS']);
      expect(payload.sisLmsBridgeRequested).toBe(true);
      expect(typeof payload.logoKey).toBe('string');
      expect(typeof payload.accreditationEvidenceKey).toBe('string');
      expect(payload.logoFileName).toBe('logo.png');
      expect(payload.accreditationEvidenceFileName).toBe('accreditation.pdf');

      expect(putBufferSpy).toHaveBeenCalledTimes(2);
      const storageKeys = putBufferSpy.mock.calls.map((c) => c[0] as string);
      expect(storageKeys.some((k) => k.includes('/logo.'))).toBe(true);
      expect(storageKeys.some((k) => k.includes('/accreditation.'))).toBe(true);

      expect(mailSpy).toHaveBeenCalledTimes(1);
      const [inbox, subject, , html] = mailSpy.mock.calls[0] as [string, string, string, string];
      expect(inbox).toBe('platform@unicore.test');
      expect(subject).toContain('New institution onboarding');
      expect(subject).toContain('Northbridge University');
      expect(html).toContain(`/admin/registration-requests/${result.requestId}`);
      expect(notifySubmittedSpy).toHaveBeenCalledTimes(1);
    });

    it('rejects when LMS is selected without SIS', async () => {
      const dto = validDto({ modulesInterested: [TenantModule.LMS] });
      const logo = fakeFile(
        'logo',
        'logo.png',
        'image/png',
        Buffer.concat([PNG_HEADER, Buffer.alloc(32, 0x10)]),
      );
      const evidence = fakeFile(
        'accreditationEvidence',
        'evidence.pdf',
        'application/pdf',
        Buffer.concat([PDF_HEADER, Buffer.alloc(32, 0x20)]),
      );

      await expect(
        service.submitInstitution(fakeRequest(), dto, {
          logo,
          accreditationEvidence: evidence,
        }),
      ).rejects.toThrow(/Student Information System/i);

      const count = await prisma.registrationRequest.count();
      expect(count).toBe(0);
      expect(putBufferSpy).not.toHaveBeenCalled();
    });

    it('rejects when a logo with declared image/png is actually a PDF (magic-byte mismatch)', async () => {
      const dto = validDto();
      const spoofedLogo = fakeFile(
        'logo',
        'logo.png',
        'image/png',
        Buffer.concat([PDF_HEADER, Buffer.alloc(64, 0x33)]),
      );
      const evidence = fakeFile(
        'accreditationEvidence',
        'evidence.pdf',
        'application/pdf',
        Buffer.concat([PDF_HEADER, Buffer.alloc(64, 0x44)]),
      );

      await expect(
        service.submitInstitution(fakeRequest(), dto, {
          logo: spoofedLogo,
          accreditationEvidence: evidence,
        }),
      ).rejects.toThrow(/spoofing|content type/i);

      const count = await prisma.registrationRequest.count();
      expect(count).toBe(0);
    });

    it('allows submissions without evidence when not_accredited', async () => {
      const dto = validDto({
        accreditationStatus: 'not_accredited',
        accreditationBody: undefined,
      });
      const logo = fakeFile(
        'logo',
        'logo.png',
        'image/png',
        Buffer.concat([PNG_HEADER, Buffer.alloc(64, 0x55)]),
      );

      const result = await service.submitInstitution(fakeRequest(), dto, { logo });

      expect(result.ok).toBe(true);
      const row = await prisma.registrationRequest.findUnique({ where: { id: result.requestId } });
      const payload = row?.payload as Record<string, unknown>;
      expect(payload.accreditationEvidenceKey).toBeUndefined();
      expect(putBufferSpy).toHaveBeenCalledTimes(1);
    });
  },
);
