import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import type { Request } from 'express';
import { TenantModule } from '@prisma/client';
import {
  MODULES_BUNDLED_WITH_LMS,
  MODULES_BUNDLED_WITH_SIS,
  REGISTRATION_TENANT_MODULES,
  resolveModulesFromCoreSelection,
} from '../common/tenant-modules/tenant-module-packages';
import { NotificationEventsService } from '../notifications/notification-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ObjectStorageService } from '../storage/object-storage.service';
import type { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import type { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import type { RegisterInstitutionDto } from './dto/register-institution.dto';
import {
  assertRegistrationEvidence,
  assertRegistrationLogo,
  registrationIntakeExtension,
} from './register-institution-intake.util';

export type InstitutionRegistrationFiles = {
  logo?: Express.Multer.File;
  accreditationEvidence?: Express.Multer.File;
};

type RegistrationPayloadSummary = {
  institutionName?: unknown;
};

type RegistrationDocumentKind = 'logo' | 'accreditationEvidence';
type RegistrationPayloadRecord = Record<string, unknown>;
type RegistrationAddressPayload = {
  line1?: unknown;
  line2?: unknown;
  city?: unknown;
  stateProvince?: unknown;
  postalCode?: unknown;
  country?: unknown;
};
type RegistrationAccreditationPayload = {
  status?: unknown;
  body?: unknown;
  reference?: unknown;
  validUntil?: unknown;
};
type RegistrationContactPayload = {
  firstName?: unknown;
  lastName?: unknown;
  fullName?: unknown;
  title?: unknown;
  phone?: unknown;
  email?: unknown;
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

function contentTypeFromKey(key: string): string {
  const normalized = key.toLowerCase();
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'image/jpeg';
  if (normalized.endsWith('.webp')) return 'image/webp';
  if (normalized.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}

function safeDownloadName(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }
  return value.trim().replace(/[^\w.\- ]+/g, '_');
}

function payloadString(payload: RegistrationPayloadRecord, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function payloadRecord<T extends Record<string, unknown>>(
  payload: RegistrationPayloadRecord,
  key: string,
): T {
  const value = payload[key];
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as T) : ({} as T);
}

function registrationEmailMatches(
  row: { email: string; payload: unknown },
  email: string,
): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) {
    return false;
  }
  const payload = (row.payload ?? {}) as RegistrationPayloadRecord;
  const contact = payloadRecord<RegistrationContactPayload>(payload, 'contact');
  const candidates = uniqueValidEmails(
    row.email,
    payloadString(payload, 'institutionEmail'),
    typeof contact.email === 'string' ? contact.email : undefined,
  );
  return candidates.includes(normalized);
}

function corePackagesFromPayload(payload: RegistrationPayloadRecord): TenantModule[] {
  const value = payload.corePackages;
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is TenantModule =>
    REGISTRATION_TENANT_MODULES.includes(item as TenantModule),
  );
}

function estimatedStudentsFromPayload(value: unknown): RegisterInstitutionDto['estimatedStudents'] {
  return value === 'under-500' ||
    value === '500-2000' ||
    value === '2000-10000' ||
    value === '10000-plus'
    ? value
    : 'under-500';
}

@Injectable()
export class AuthRegistrationService {
  private readonly log = new Logger(AuthRegistrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly storage: ObjectStorageService,
    private readonly notificationEvents: NotificationEventsService,
  ) {}

  private clientMeta(req: Request) {
    return {
      ipAddress: req.ip ?? req.socket?.remoteAddress ?? undefined,
      userAgent: req.headers['user-agent']?.slice(0, 512),
    };
  }

  private platformInbox(): string | null {
    const inbox =
      process.env.PLATFORM_INBOX_EMAIL?.trim() ?? process.env.SUPER_ADMIN_EMAIL?.trim() ?? null;
    return inbox;
  }

  private webPublicBase(): string {
    return (
      process.env.WEB_PUBLIC_URL?.trim() ??
      process.env.NEXT_PUBLIC_WEB_URL?.trim() ??
      'http://localhost:3000'
    ).replace(/\/$/, '');
  }

  private registrationAdminUrl(requestId: string): string {
    return `${this.webPublicBase()}/admin/registration-requests/${requestId}`;
  }

  private registrationTrackerUrl(requestId: string): string {
    return `${this.webPublicBase()}/register?reference=${encodeURIComponent(requestId)}`;
  }

  private async notifyPlatform(subject: string, text: string, html: string) {
    const inbox = this.platformInbox();
    if (!inbox) {
      this.log.warn(`Platform inbox not set. ${subject}\n${text}`);
      return;
    }
    await this.mail.sendEmail(inbox, subject, text, html);
  }

  private async emailRegistrationReference(args: {
    recipients: string[];
    contactName: string;
    institutionName: string;
    requestId: string;
  }): Promise<void> {
    if (args.recipients.length === 0) {
      return;
    }

    const trackerUrl = this.registrationTrackerUrl(args.requestId);
    const subject = `UniCore onboarding reference — ${args.institutionName}`;
    const text = [
      `Hello ${args.contactName || 'there'},`,
      '',
      `We received the UniCore onboarding request for ${args.institutionName}.`,
      '',
      `Tracking reference: ${args.requestId}`,
      `Track status: ${trackerUrl}`,
      '',
      'Keep this reference for follow-up correspondence.',
      '',
      '— The UniCore platform team',
    ].join('\n');
    const html = `<p>Hello ${args.contactName || 'there'},</p>
      <p>We received the UniCore onboarding request for <strong>${args.institutionName}</strong>.</p>
      <p><strong>Tracking reference</strong><br/><code>${args.requestId}</code></p>
      <p><a href="${trackerUrl}">Track this onboarding request</a></p>
      <p>Keep this reference for follow-up correspondence.</p>
      <p>&mdash; The UniCore platform team</p>`;

    await Promise.all(
      args.recipients.map((recipient) => this.mail.sendEmail(recipient, subject, text, html)),
    );
  }

  private assertRegistrationModules(corePackages: TenantModule[]): void {
    if (corePackages.length === 0) {
      throw new BadRequestException(
        'Select at least one core package: Student Information System (SIS) and/or Learning Management (LMS).',
      );
    }
    for (const module of corePackages) {
      if (!REGISTRATION_TENANT_MODULES.includes(module)) {
        throw new BadRequestException(`Package ${module} is not available during onboarding.`);
      }
    }
  }

  private async buildRegistrationPayload(
    dto: RegisterInstitutionDto,
    files: InstitutionRegistrationFiles,
    existingPayload?: RegistrationPayloadRecord,
  ) {
    this.assertRegistrationModules(dto.modulesInterested);
    const intakeId = randomBytes(12).toString('hex');
    let logoKey = existingPayload ? payloadString(existingPayload, 'logoKey') : undefined;
    let logoFileName = existingPayload ? payloadString(existingPayload, 'logoFileName') : undefined;

    if (files.logo) {
      const logo = assertRegistrationLogo(files.logo);
      const logoStored = await this.storage.putBuffer(
        `registration-intake/${intakeId}/logo.${registrationIntakeExtension(logo.mimetype)}`,
        logo.buffer,
        logo.mimetype,
      );
      logoKey = logoStored.key;
      logoFileName = logo.originalname;
    }
    if (!logoKey) {
      throw new BadRequestException('Institution logo is required');
    }

    let accreditationEvidenceKey = existingPayload
      ? payloadString(existingPayload, 'accreditationEvidenceKey')
      : undefined;
    let accreditationEvidenceFileName = existingPayload
      ? payloadString(existingPayload, 'accreditationEvidenceFileName')
      : undefined;

    if (dto.accreditationStatus === 'not_accredited') {
      accreditationEvidenceKey = undefined;
      accreditationEvidenceFileName = undefined;
    } else if (files.accreditationEvidence) {
      const evidence = assertRegistrationEvidence(
        files.accreditationEvidence,
        dto.accreditationStatus,
      );
      if (!evidence) {
        throw new BadRequestException('Accreditation evidence document is required');
      }
      const evidenceStored = await this.storage.putBuffer(
        `registration-intake/${intakeId}/accreditation.${registrationIntakeExtension(evidence.mimetype)}`,
        evidence.buffer,
        evidence.mimetype,
      );
      accreditationEvidenceKey = evidenceStored.key;
      accreditationEvidenceFileName = evidence.originalname;
    } else if (!accreditationEvidenceKey) {
      throw new BadRequestException('Accreditation evidence document is required');
    }

    const email = dto.contactEmail.trim().toLowerCase();
    const institutionEmail = dto.institutionEmail.trim().toLowerCase();
    const contactName = `${dto.contactFirstName.trim()} ${dto.contactLastName.trim()}`.trim();
    const corePackages = [...dto.modulesInterested];
    const modulesEffective = resolveModulesFromCoreSelection(corePackages);
    const bundledWithSis = corePackages.includes(TenantModule.SIS)
      ? [...MODULES_BUNDLED_WITH_SIS]
      : [];
    const bundledWithLms = corePackages.includes(TenantModule.LMS)
      ? [...MODULES_BUNDLED_WITH_LMS]
      : [];
    const sisLmsBridgeRequested =
      corePackages.includes(TenantModule.SIS) && corePackages.includes(TenantModule.LMS);

    const address = {
      line1: dto.addressLine1.trim(),
      line2: dto.addressLine2?.trim() || undefined,
      city: dto.city.trim(),
      stateProvince: dto.stateProvince.trim(),
      postalCode: dto.postalCode.trim(),
      country: dto.country.trim(),
    };

    return {
      email,
      institutionEmail,
      contactName,
      corePackages,
      modulesEffective,
      payload: {
        institutionName: dto.institutionName.trim(),
        institutionType: dto.institutionType,
        institutionEmail,
        address,
        accreditation: {
          status: dto.accreditationStatus,
          body: dto.accreditationBody?.trim() || undefined,
          reference: dto.accreditationReference?.trim() || undefined,
          validUntil: dto.accreditationValidUntil?.trim() || undefined,
        },
        contact: {
          firstName: dto.contactFirstName.trim(),
          lastName: dto.contactLastName.trim(),
          fullName: contactName,
          title: dto.contactTitle.trim(),
          phone: dto.contactPhone.trim(),
          email,
        },
        logoKey,
        logoFileName,
        accreditationEvidenceKey,
        accreditationEvidenceFileName,
        country: dto.country.trim(),
        estimatedStudents: dto.estimatedStudents,
        corePackages,
        modulesEffective,
        bundledWithSis,
        bundledWithLms,
        sisLmsBridgeRequested,
        message: dto.message?.trim() || undefined,
      },
    };
  }

  async submitInstitution(
    req: Request,
    dto: RegisterInstitutionDto,
    files: InstitutionRegistrationFiles,
  ) {
    this.assertRegistrationModules(dto.modulesInterested);
    const logo = assertRegistrationLogo(files.logo);
    const evidence = assertRegistrationEvidence(
      files.accreditationEvidence,
      dto.accreditationStatus,
    );

    const intakeId = randomBytes(12).toString('hex');
    const logoStored = await this.storage.putBuffer(
      `registration-intake/${intakeId}/logo.${registrationIntakeExtension(logo.mimetype)}`,
      logo.buffer,
      logo.mimetype,
    );
    let evidenceStored: { key: string; url: string } | undefined;
    if (evidence) {
      evidenceStored = await this.storage.putBuffer(
        `registration-intake/${intakeId}/accreditation.${registrationIntakeExtension(evidence.mimetype)}`,
        evidence.buffer,
        evidence.mimetype,
      );
    }

    const email = dto.contactEmail.trim().toLowerCase();
    const institutionEmail = dto.institutionEmail.trim().toLowerCase();
    const contactName = `${dto.contactFirstName.trim()} ${dto.contactLastName.trim()}`.trim();
    const corePackages = [...dto.modulesInterested];
    const modulesEffective = resolveModulesFromCoreSelection(corePackages);
    const bundledWithSis = corePackages.includes(TenantModule.SIS)
      ? [...MODULES_BUNDLED_WITH_SIS]
      : [];
    const bundledWithLms = corePackages.includes(TenantModule.LMS)
      ? [...MODULES_BUNDLED_WITH_LMS]
      : [];
    const sisLmsBridgeRequested =
      corePackages.includes(TenantModule.SIS) && corePackages.includes(TenantModule.LMS);

    const address = {
      line1: dto.addressLine1.trim(),
      line2: dto.addressLine2?.trim() || undefined,
      city: dto.city.trim(),
      stateProvince: dto.stateProvince.trim(),
      postalCode: dto.postalCode.trim(),
      country: dto.country.trim(),
    };

    const row = await this.prisma.registrationRequest.create({
      data: {
        kind: 'NEW_INSTITUTION',
        email,
        payload: {
          institutionName: dto.institutionName.trim(),
          institutionType: dto.institutionType,
          institutionEmail,
          address,
          accreditation: {
            status: dto.accreditationStatus,
            body: dto.accreditationBody?.trim() || undefined,
            reference: dto.accreditationReference?.trim() || undefined,
            validUntil: dto.accreditationValidUntil?.trim() || undefined,
          },
          contact: {
            firstName: dto.contactFirstName.trim(),
            lastName: dto.contactLastName.trim(),
            fullName: contactName,
            title: dto.contactTitle.trim(),
            phone: dto.contactPhone.trim(),
            email,
          },
          logoKey: logoStored.key,
          logoFileName: logo.originalname,
          accreditationEvidenceKey: evidenceStored?.key,
          accreditationEvidenceFileName: evidence?.originalname,
          country: dto.country.trim(),
          estimatedStudents: dto.estimatedStudents,
          corePackages,
          modulesEffective,
          bundledWithSis,
          bundledWithLms,
          sisLmsBridgeRequested,
          message: dto.message?.trim() || undefined,
        },
        ...this.clientMeta(req),
      },
    });

    const addressLine = [
      address.line1,
      address.line2,
      `${address.city}, ${address.stateProvince} ${address.postalCode}`,
      address.country,
    ]
      .filter(Boolean)
      .join('\n');

    const reviewUrl = this.registrationAdminUrl(row.id);

    await this.notifyPlatform(
      `[UniCore] New institution onboarding — ${dto.institutionName}`,
      [
        `Kind: New institution`,
        `Legal name: ${dto.institutionName}`,
        `Institutional email: ${dto.institutionEmail}`,
        `Type: ${dto.institutionType}`,
        `Address:\n${addressLine}`,
        `Accreditation: ${dto.accreditationStatus}`,
        dto.accreditationBody ? `Accrediting body: ${dto.accreditationBody}` : '',
        dto.accreditationReference ? `Reference: ${dto.accreditationReference}` : '',
        evidenceStored ? `Evidence uploaded: yes` : `Evidence uploaded: no`,
        `Contact: ${contactName} (${dto.contactTitle})`,
        `Contact phone: ${dto.contactPhone}`,
        `Contact email: ${email}`,
        `Logo uploaded: yes`,
        dto.estimatedStudents ? `Students: ${dto.estimatedStudents}` : '',
        `Core packages: ${corePackages.join(', ')}`,
        `Modules to enable on provision: ${modulesEffective.join(', ')}`,
        dto.message ? `Message: ${dto.message}` : '',
        `Request ID: ${row.id}`,
        '',
        `Review this request: ${reviewUrl}`,
      ]
        .filter(Boolean)
        .join('\n'),
      `<p><strong>New institution onboarding</strong></p>
       <ul>
         <li>Legal name: ${dto.institutionName}</li>
         <li>Institutional email: ${dto.institutionEmail}</li>
         <li>Type: ${dto.institutionType}</li>
         <li>Address: ${addressLine.replace(/\n/g, '<br/>')}</li>
         <li>Accreditation: ${dto.accreditationStatus}${dto.accreditationBody ? ` (${dto.accreditationBody})` : ''}</li>
         <li>Contact: ${contactName} · ${dto.contactTitle} · ${dto.contactPhone} · ${email}</li>
         <li>Logo &amp; evidence stored for review</li>
         <li>Reference: ${row.id}</li>
       </ul>
       <p><a href="${reviewUrl}">Open onboarding dossier in UniCore</a></p>`,
    );

    try {
      await this.emailRegistrationReference({
        recipients: uniqueValidEmails(email, institutionEmail),
        contactName,
        institutionName: dto.institutionName.trim(),
        requestId: row.id,
      });
    } catch (err) {
      this.log.warn(
        `Reference email for registration ${row.id} failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    try {
      await this.notificationEvents.notifyRegistrationSubmitted({
        requestId: row.id,
        institutionName: dto.institutionName.trim(),
        contactName,
        contactEmail: email,
      });
    } catch (err) {
      this.log.warn(
        `In-app alert for new registration ${row.id} failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    return { ok: true as const, requestId: row.id };
  }

  private async enrichRegistrationRequest<T extends { payload: unknown }>(row: T) {
    const payload = row.payload as Record<string, unknown>;
    const logoKey = typeof payload.logoKey === 'string' ? payload.logoKey : undefined;
    const evidenceKey =
      typeof payload.accreditationEvidenceKey === 'string'
        ? payload.accreditationEvidenceKey
        : undefined;

    return {
      ...row,
      documents: {
        logoUrl: logoKey ? await this.storage.resolveDownloadUrl(logoKey) : null,
        accreditationEvidenceUrl: evidenceKey
          ? await this.storage.resolveDownloadUrl(evidenceKey)
          : null,
      },
    };
  }

  async requestPasswordReset(req: Request, dto: PasswordResetRequestDto) {
    const slug = dto.institutionSlug.trim();
    const email = dto.email.trim().toLowerCase();
    const institution = await this.prisma.institution.findFirst({
      where: { slug, deletedAt: null },
    });
    if (!institution) {
      return { ok: true as const, delivered: false };
    }
    if (institution.status === 'SUSPENDED') {
      return { ok: true as const, delivered: false };
    }

    const user = await this.prisma.user.findFirst({
      where: { email, institutionId: institution.id, deletedAt: null, isActive: true },
    });
    if (!user) {
      return { ok: true as const, delivered: false };
    }

    const plain = randomBytes(24).toString('hex');
    const tokenHash = createHash('sha256').update(plain).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60_000);

    await this.prisma.passwordResetToken.create({
      data: {
        institutionId: institution.id,
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    const webBase = process.env.WEB_PUBLIC_URL?.trim() ?? 'http://localhost:3000';
    const link = `${webBase.replace(/\/$/, '')}/forgot-password?token=${encodeURIComponent(plain)}`;
    await this.mail.sendEmail(
      user.email,
      'Reset your UniCore password',
      `Reset your password (valid 1 hour): ${link}`,
      `<p>Reset your UniCore password</p><p><a href="${link}">Choose a new password</a></p><p>This link expires in one hour.</p>`,
    );

    return { ok: true as const, delivered: true };
  }

  async confirmPasswordReset(dto: PasswordResetConfirmDto) {
    const tokenHash = createHash('sha256').update(dto.token.trim()).digest('hex');
    const row = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash, consumedAt: null },
    });
    if (!row || row.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired reset link');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: row.userId },
        data: { passwordHash, sessionVersion: { increment: 1 } },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: row.id },
        data: { consumedAt: new Date() },
      }),
    ]);

    return { ok: true as const };
  }

  async getRegistrationRequest(id: string) {
    const row = await this.prisma.registrationRequest.findUnique({
      where: { id },
      include: {
        institution: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!row) {
      throw new BadRequestException('Request not found');
    }
    return this.enrichRegistrationRequest(row);
  }

  async getRegistrationDocument(id: string, document: RegistrationDocumentKind) {
    const row = await this.prisma.registrationRequest.findUnique({
      where: { id },
      select: { payload: true },
    });
    if (!row) {
      throw new NotFoundException('Request not found');
    }

    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const keyField = document === 'logo' ? 'logoKey' : 'accreditationEvidenceKey';
    const nameField = document === 'logo' ? 'logoFileName' : 'accreditationEvidenceFileName';
    const key = typeof payload[keyField] === 'string' ? payload[keyField] : undefined;
    if (!key) {
      throw new NotFoundException('Document not found');
    }

    const buffer = await this.storage.getBuffer(key);
    if (!buffer) {
      throw new NotFoundException('Document content not found');
    }

    return {
      buffer,
      contentType: contentTypeFromKey(key),
      filename: safeDownloadName(payload[nameField], `${document}-${id}`),
    };
  }

  async getEditableInstitutionRegistration(requestId: string, email: string | undefined) {
    const id = requestId.trim();
    if (!id) {
      throw new BadRequestException('Tracking reference is required');
    }
    if (!email?.trim()) {
      throw new BadRequestException('Verification email is required');
    }

    const row = await this.prisma.registrationRequest.findUnique({
      where: { id },
      select: {
        id: true,
        kind: true,
        status: true,
        email: true,
        institutionId: true,
        createdAt: true,
        reviewedAt: true,
        payload: true,
      },
    });
    if (!row || row.kind !== 'NEW_INSTITUTION') {
      throw new NotFoundException('Editable registration request not found');
    }
    if (!registrationEmailMatches(row, email)) {
      throw new UnauthorizedException('Reference and verification email do not match');
    }
    if (row.status === 'DISMISSED') {
      throw new BadRequestException('This request is closed and can no longer be updated');
    }
    if (row.institutionId) {
      throw new BadRequestException('This request has already completed onboarding');
    }

    const payload = (row.payload ?? {}) as RegistrationPayloadRecord;
    const address = payloadRecord<RegistrationAddressPayload>(payload, 'address');
    const accreditation = payloadRecord<RegistrationAccreditationPayload>(payload, 'accreditation');
    const contact = payloadRecord<RegistrationContactPayload>(payload, 'contact');
    const modulesInterested = corePackagesFromPayload(payload);

    return {
      reference: row.id,
      status: row.status,
      submittedAt: row.createdAt,
      reviewedAt: row.reviewedAt,
      values: {
        institutionName: stringValue(payload.institutionName),
        institutionType: stringValue(payload.institutionType) || 'university',
        institutionEmail: stringValue(payload.institutionEmail),
        addressLine1: stringValue(address.line1),
        addressLine2: stringValue(address.line2),
        city: stringValue(address.city),
        stateProvince: stringValue(address.stateProvince),
        postalCode: stringValue(address.postalCode),
        country: stringValue(address.country) || stringValue(payload.country),
        accreditationStatus: stringValue(accreditation.status) || 'accredited',
        accreditationBody: stringValue(accreditation.body),
        accreditationReference: stringValue(accreditation.reference),
        accreditationValidUntil: stringValue(accreditation.validUntil),
        contactFirstName: stringValue(contact.firstName),
        contactLastName: stringValue(contact.lastName),
        contactTitle: stringValue(contact.title),
        contactPhone: stringValue(contact.phone),
        contactEmail: stringValue(contact.email) || row.email,
        estimatedStudents: estimatedStudentsFromPayload(payload.estimatedStudents),
        modulesInterested: modulesInterested.length > 0 ? modulesInterested : [TenantModule.SIS],
        message: stringValue(payload.message),
      },
      documents: {
        hasLogo: Boolean(payloadString(payload, 'logoKey')),
        logoFileName: payloadString(payload, 'logoFileName') ?? null,
        hasAccreditationEvidence: Boolean(payloadString(payload, 'accreditationEvidenceKey')),
        accreditationEvidenceFileName:
          payloadString(payload, 'accreditationEvidenceFileName') ?? null,
      },
    };
  }

  async updateInstitutionRegistration(
    req: Request,
    requestId: string,
    verificationEmail: string | undefined,
    dto: RegisterInstitutionDto,
    files: InstitutionRegistrationFiles,
  ) {
    const id = requestId.trim();
    if (!id) {
      throw new BadRequestException('Tracking reference is required');
    }
    if (!verificationEmail?.trim()) {
      throw new BadRequestException('Verification email is required');
    }

    const row = await this.prisma.registrationRequest.findUnique({
      where: { id },
      select: {
        id: true,
        kind: true,
        status: true,
        email: true,
        institutionId: true,
        payload: true,
      },
    });
    if (!row || row.kind !== 'NEW_INSTITUTION') {
      throw new NotFoundException('Editable registration request not found');
    }
    if (!registrationEmailMatches(row, verificationEmail)) {
      throw new UnauthorizedException('Reference and verification email do not match');
    }
    if (row.status === 'DISMISSED') {
      throw new BadRequestException('This request is closed and can no longer be updated');
    }
    if (row.institutionId) {
      throw new BadRequestException('This request has already completed onboarding');
    }

    const existingPayload = (row.payload ?? {}) as RegistrationPayloadRecord;
    const prepared = await this.buildRegistrationPayload(dto, files, existingPayload);
    const updated = await this.prisma.registrationRequest.update({
      where: { id },
      data: {
        email: prepared.email,
        status: 'PENDING',
        reviewedAt: null,
        payload: {
          ...prepared.payload,
          lastRegistrantUpdateAt: new Date().toISOString(),
        },
        ...this.clientMeta(req),
      },
    });

    try {
      await this.notifyPlatform(
        `[UniCore] Institution onboarding updated — ${dto.institutionName}`,
        [
          `Kind: Updated institution onboarding`,
          `Legal name: ${dto.institutionName}`,
          `Institutional email: ${prepared.institutionEmail}`,
          `Contact: ${prepared.contactName} <${prepared.email}>`,
          `Core packages: ${prepared.corePackages.join(', ')}`,
          `Modules to enable on provision: ${prepared.modulesEffective.join(', ')}`,
          `Request ID: ${updated.id}`,
          '',
          `Review this request: ${this.registrationAdminUrl(updated.id)}`,
        ].join('\n'),
        `<p><strong>Institution onboarding updated</strong></p>
         <ul>
           <li>Legal name: ${dto.institutionName}</li>
           <li>Institutional email: ${prepared.institutionEmail}</li>
           <li>Contact: ${prepared.contactName} &lt;${prepared.email}&gt;</li>
           <li>Reference: ${updated.id}</li>
         </ul>
         <p><a href="${this.registrationAdminUrl(updated.id)}">Open updated dossier in UniCore</a></p>`,
      );
    } catch (err) {
      this.log.warn(
        `Platform update email for registration ${updated.id} failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    return { ok: true as const, requestId: updated.id, status: updated.status };
  }

  async getRegistrationTrackingStatus(requestId: string) {
    const id = requestId.trim();
    if (!id) {
      throw new BadRequestException('Tracking reference is required');
    }

    const row = await this.prisma.registrationRequest.findUnique({
      where: { id },
      select: {
        id: true,
        kind: true,
        status: true,
        institutionId: true,
        createdAt: true,
        reviewedAt: true,
        payload: true,
      },
    });
    if (!row) {
      throw new NotFoundException('Tracking reference not found');
    }

    const payload = (row.payload ?? {}) as RegistrationPayloadSummary;
    return {
      reference: row.id,
      kind: row.kind,
      status: row.status,
      submittedAt: row.createdAt,
      reviewedAt: row.reviewedAt,
      canUpdate:
        row.kind === 'NEW_INSTITUTION' && row.status !== 'DISMISSED' && row.institutionId === null,
      institutionName:
        typeof payload.institutionName === 'string' && payload.institutionName.trim()
          ? payload.institutionName.trim()
          : null,
    };
  }

  async listRegistrationRequests(query: { status?: string; kind?: string; limit?: number }) {
    const limit = Math.min(query.limit ?? 50, 100);
    const where: {
      status?: 'PENDING' | 'REVIEWED' | 'PROVISIONED' | 'DISMISSED';
      kind?: 'JOIN_INSTITUTION' | 'NEW_INSTITUTION';
    } = {};
    if (
      query.status === 'PENDING' ||
      query.status === 'REVIEWED' ||
      query.status === 'PROVISIONED' ||
      query.status === 'DISMISSED'
    ) {
      where.status = query.status;
    }
    if (query.kind === 'JOIN_INSTITUTION' || query.kind === 'NEW_INSTITUTION') {
      where.kind = query.kind;
    }

    const rows = await this.prisma.registrationRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        institution: { select: { id: true, name: true, slug: true } },
      },
    });

    return { data: rows };
  }

  async reviewRegistrationRequest(id: string, status: 'REVIEWED' | 'DISMISSED') {
    const row = await this.prisma.registrationRequest.findUnique({ where: { id } });
    if (!row) {
      throw new BadRequestException('Request not found');
    }
    return this.prisma.registrationRequest.update({
      where: { id },
      data: { status, reviewedAt: new Date() },
    });
  }
}
