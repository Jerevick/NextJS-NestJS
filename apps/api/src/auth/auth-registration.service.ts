import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
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

  private async notifyPlatform(subject: string, text: string, html: string) {
    const inbox = this.platformInbox();
    if (!inbox) {
      this.log.warn(`Platform inbox not set. ${subject}\n${text}`);
      return;
    }
    await this.mail.sendEmail(inbox, subject, text, html);
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
    if (corePackages.includes(TenantModule.LMS) && !corePackages.includes(TenantModule.SIS)) {
      throw new BadRequestException(
        'Learning Management requires the Student Information System for enrollment-linked access.',
      );
    }
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
          institutionEmail: dto.institutionEmail.trim().toLowerCase(),
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

  async listRegistrationRequests(query: { status?: string; kind?: string; limit?: number }) {
    const limit = Math.min(query.limit ?? 50, 100);
    const where: {
      status?: 'PENDING' | 'REVIEWED' | 'DISMISSED';
      kind?: 'JOIN_INSTITUTION' | 'NEW_INSTITUTION';
    } = {};
    if (query.status === 'PENDING' || query.status === 'REVIEWED' || query.status === 'DISMISSED') {
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
