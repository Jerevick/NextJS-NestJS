import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

function hashFullKey(fullKey: string): string {
  return createHash('sha256').update(fullKey, 'utf8').digest('hex');
}

function assertManageAffiliates(actor: AuthUser, institutionId: string): void {
  if (actor.permissions.includes('*')) {
    return;
  }
  if (actor.institutionId !== institutionId) {
    throw new ForbiddenException('You may only manage affiliates for your own institution');
  }
  if (!actor.permissions.includes('institutions.write')) {
    throw new ForbiddenException('Missing permission to manage affiliate partners');
  }
}

function assertReadAffiliates(actor: AuthUser, institutionId: string): void {
  if (actor.permissions.includes('*')) {
    return;
  }
  if (actor.institutionId !== institutionId) {
    throw new ForbiddenException('You may only view affiliates for your own institution');
  }
  if (
    !actor.permissions.includes('institutions.read') &&
    !actor.permissions.includes('institutions.write')
  ) {
    throw new ForbiddenException('Missing permission to view affiliate partners');
  }
}

@Injectable()
export class AffiliateService {
  constructor(private readonly prisma: PrismaService) {}

  async listPartners(actor: AuthUser, institutionId: string) {
    assertReadAffiliates(actor, institutionId);
    return this.prisma.affiliatePartner.findMany({
      where: { institutionId },
      select: {
        id: true,
        label: true,
        entityId: true,
        revokedAt: true,
        createdAt: true,
        apiKeyLookup: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createLink(actor: AuthUser, institutionId: string, label: string, entityId?: string | null) {
    assertManageAffiliates(actor, institutionId);
    const trimmed = label.trim();
    if (trimmed.length < 2) {
      throw new BadRequestException('label is required');
    }
    let scopedEntityId: string | null = null;
    const rawEntity = entityId?.trim();
    if (rawEntity) {
      const ent = await this.prisma.institutionEntity.findFirst({
        where: { id: rawEntity, institutionId, deletedAt: null, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!ent) {
        throw new BadRequestException('Invalid or inactive entityId');
      }
      scopedEntityId = ent.id;
    }
    const lookup = randomBytes(8).toString('hex');
    const secret = randomBytes(24).toString('hex');
    const fullKey = `${lookup}.${secret}`;
    const apiKeyHash = hashFullKey(fullKey);
    const row = await this.prisma.affiliatePartner.create({
      data: {
        institutionId,
        entityId: scopedEntityId,
        label: trimmed,
        apiKeyLookup: lookup,
        apiKeyHash,
      },
      select: { id: true, label: true, entityId: true, createdAt: true },
    });
    return { ...row, apiKey: fullKey };
  }

  async revokeLink(actor: AuthUser, institutionId: string, partnerId: string) {
    assertManageAffiliates(actor, institutionId);
    const result = await this.prisma.affiliatePartner.updateMany({
      where: { id: partnerId, institutionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundException('Affiliate partner not found');
    }
    return { ok: true as const };
  }

  private async resolvePartnerFromApiKey(rawKey: string) {
    const key = rawKey.trim();
    const dot = key.indexOf('.');
    if (dot < 1) {
      return null;
    }
    const lookup = key.slice(0, dot);
    const row = await this.prisma.affiliatePartner.findFirst({
      where: { apiKeyLookup: lookup, revokedAt: null },
      include: { institution: { select: { id: true, slug: true } } },
    });
    if (!row) {
      return null;
    }
    const expected = Buffer.from(row.apiKeyHash, 'hex');
    const actual = createHash('sha256').update(key, 'utf8').digest();
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      return null;
    }
    return row;
  }

  async verifyStudentEnrollment(
    institutionSlug: string,
    studentNumber: string,
    apiKeyHeader: string | undefined,
  ): Promise<{ enrolled: boolean; programme: string }> {
    if (!apiKeyHeader?.trim()) {
      throw new UnauthorizedException('Missing X-Affiliate-Key header');
    }
    const partner = await this.resolvePartnerFromApiKey(apiKeyHeader);
    if (!partner) {
      throw new UnauthorizedException('Invalid affiliate API key');
    }
    const inst = await this.prisma.institution.findFirst({
      where: { slug: institutionSlug.trim(), deletedAt: null },
      select: { id: true },
    });
    if (!inst || inst.id !== partner.institutionId) {
      throw new ForbiddenException('Institution mismatch');
    }
    const student = await this.prisma.student.findFirst({
      where: { institutionId: inst.id, studentNumber: studentNumber.trim(), deletedAt: null },
      include: { program: { select: { name: true } } },
    });
    if (!student) {
      return { enrolled: false, programme: '' };
    }
    if (partner.entityId && student.entityId !== partner.entityId) {
      return { enrolled: false, programme: '' };
    }
    const enrolled = student.enrollmentStatus === 'ACTIVE';
    return { enrolled, programme: student.program.name };
  }

  async verifyTranscriptCode(
    institutionSlug: string,
    code: string,
    apiKeyHeader: string | undefined,
  ): Promise<{ valid: boolean; issuedAt: string; institution: string; type?: 'official' | 'unofficial' }> {
    if (!apiKeyHeader?.trim()) {
      throw new UnauthorizedException('Missing X-Affiliate-Key header');
    }
    const partner = await this.resolvePartnerFromApiKey(apiKeyHeader);
    if (!partner) {
      throw new UnauthorizedException('Invalid affiliate API key');
    }
    const inst = await this.prisma.institution.findFirst({
      where: { slug: institutionSlug.trim(), deletedAt: null },
      select: { id: true, name: true },
    });
    if (!inst || inst.id !== partner.institutionId) {
      throw new ForbiddenException('Institution mismatch');
    }
    const trimmed = code.trim();
    if (!trimmed) {
      return { valid: false, issuedAt: '', institution: inst.name };
    }
    const row = await this.prisma.transcript.findFirst({
      where: {
        institutionId: inst.id,
        verificationHash: trimmed,
        deletedAt: null,
        ...(partner.entityId
          ? { student: { entityId: partner.entityId } }
          : {}),
      },
      select: { generatedAt: true, isOfficial: true },
    });
    if (!row) {
      return { valid: false, issuedAt: '', institution: inst.name };
    }
    return {
      valid: true,
      issuedAt: row.generatedAt.toISOString(),
      institution: inst.name,
      type: row.isOfficial ? 'official' : 'unofficial',
    };
  }
}
