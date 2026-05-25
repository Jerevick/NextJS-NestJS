import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import type { Request } from 'express';
import * as QRCode from 'qrcode';
import * as speakeasy from 'speakeasy';
import type { JwtAccessPayload } from '@unicore/types';
import type { UserRole } from '@unicore/types';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import type { AuthPosition, AuthUser } from './auth.types';
import { MailService } from '../mail/mail.service';
import type { DisableTotpDto } from './dto/disable-totp.dto';
import type { EnableTotpDto } from './dto/enable-totp.dto';
import type { LoginDto } from './dto/login.dto';
import type { MagicLinkConsumeDto } from './dto/magic-link-consume.dto';
import type { MagicLinkRequestDto } from './dto/magic-link-request.dto';

const REFRESH_COOKIE = 'unicore_refresh';

@Injectable()
export class AuthService {
  private readonly revokedRefresh = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
    private readonly mail: MailService,
  ) {}

  private refreshSecret(): string {
    const s = process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET;
    if (!s) {
      throw new Error('JWT_REFRESH_SECRET or JWT_SECRET must be set');
    }
    return s;
  }

  private async assertInstitutionNotSuspended(institutionId: string): Promise<void> {
    const inst = await this.prisma.institution.findFirst({
      where: { id: institutionId, deletedAt: null },
      select: { status: true },
    });
    if (inst?.status === 'SUSPENDED') {
      throw new UnauthorizedException('Institution is suspended');
    }
  }

  private async resolveInstitutionId(req: Request, dto: LoginDto): Promise<string> {
    if (req.institution?.id) {
      return req.institution.id;
    }
    if (dto.institutionSlug) {
      const inst = await this.prisma.institution.findFirst({
        where: { slug: dto.institutionSlug, deletedAt: null },
      });
      if (!inst) {
        throw new UnauthorizedException('Unknown institution');
      }
      return inst.id;
    }
    throw new UnauthorizedException(
      'Institution context required (host, X-Institution-ID, or institutionSlug)',
    );
  }

  private async permissionsForUser(
    userId: string,
    institutionId: string,
    role: UserRole,
  ): Promise<string[]> {
    if (role === 'SUPER_ADMIN') {
      return ['*'];
    }
    const rows = await this.prisma.userRoleAssignment.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
    });
    const codes = new Set<string>();
    for (const row of rows) {
      if (row.role.institutionId !== institutionId) {
        continue;
      }
      for (const rp of row.role.permissions) {
        codes.add(rp.permission.code);
      }
    }
    return [...codes];
  }

  /** Institution-wide data scope (VC/Registrar pattern): not tied to a single campus filter in services. */
  private entityScopeFrom(role: UserRole, permissions: string[]): 'ALL' | 'ENTITY' {
    if (role === 'SUPER_ADMIN') {
      return 'ALL';
    }
    if (permissions.includes('*')) {
      return 'ALL';
    }
    if (permissions.includes('institutions.write')) {
      return 'ALL';
    }
    return 'ENTITY';
  }

  private async resolveEntityContext(
    institutionId: string,
    role: UserRole,
    permissions: string[],
    preferredEntityId?: string | null,
  ): Promise<{ entityId: string; entityScope: 'ALL' | 'ENTITY' }> {
    const entityScope = this.entityScopeFrom(role, permissions);
    const trimmed = preferredEntityId?.trim();
    if (trimmed) {
      const ent = await this.prisma.institutionEntity.findFirst({
        where: { id: trimmed, institutionId, deletedAt: null, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!ent) {
        throw new BadRequestException('Unknown or inactive campus entity');
      }
      return { entityId: ent.id, entityScope };
    }
    const main = await this.prisma.institutionEntity.findFirst({
      where: { institutionId, code: 'MAIN', deletedAt: null, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!main) {
      throw new UnauthorizedException('Institution has no active MAIN campus entity');
    }
    return { entityId: main.id, entityScope };
  }

  private async resolveActivePosition(
    userId: string,
    institutionId: string,
    entityId: string,
  ): Promise<AuthUser['position'] | undefined> {
    const holder = await this.prisma.positionHolder.findFirst({
      where: {
        userId,
        institutionId,
        entityId,
        OR: [{ endDate: null }, { endDate: { gt: new Date() } }],
      },
      orderBy: { startDate: 'desc' },
      include: {
        position: {
          select: { code: true, level: true, scope: true, orgUnitId: true, deletedAt: true },
        },
      },
    });
    if (!holder?.position || holder.position.deletedAt) {
      return undefined;
    }
    return {
      code: holder.position.code,
      level: holder.position.level,
      scope: holder.position.scope,
      orgUnitId: holder.position.orgUnitId,
    };
  }

  private async resolveLinkedStudentId(
    userId: string,
    institutionId: string,
  ): Promise<string | undefined> {
    const student = await this.prisma.student.findFirst({
      where: { userId, institutionId, deletedAt: null },
      select: { id: true, enrollmentStatus: true },
    });
    if (!student || student.enrollmentStatus !== 'ACTIVE') {
      return undefined;
    }
    return student.id;
  }

  private async buildAuthSession(
    user: {
      id: string;
      email: string;
      role: UserRole;
      institutionId: string;
      sessionVersion: number;
    },
    institutionId: string,
    rememberLongLived?: boolean,
    options?: { entityId?: string | null; skipLastLoginTouch?: boolean },
  ) {
    const permissions = await this.permissionsForUser(user.id, institutionId, user.role);
    const studentId =
      user.role === 'STUDENT'
        ? await this.resolveLinkedStudentId(user.id, institutionId)
        : undefined;
    const { entityId, entityScope } = await this.resolveEntityContext(
      institutionId,
      user.role,
      permissions,
      options?.entityId ?? null,
    );
    const position = await this.resolveActivePosition(user.id, institutionId, entityId);
    const accessJti = randomUUID();
    const payload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      institutionId,
      permissions,
      entityId,
      entityScope,
      ...(position ? { position } : {}),
      sessionVersion: user.sessionVersion,
      jti: accessJti,
    };
    const accessToken = this.jwt.sign({ ...payload });
    const jti = randomUUID();
    const refreshTtl = rememberLongLived ? '30d' : '7d';
    const refreshToken = jwt.sign(
      {
        sub: user.id,
        institutionId,
        typ: 'refresh',
        jti,
        entityId,
        entityScope,
        sessionVersion: user.sessionVersion,
      },
      this.refreshSecret(),
      { expiresIn: refreshTtl },
    );
    if (!options?.skipLastLoginTouch) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    }
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        institutionId,
        entityId,
        entityScope,
        permissions,
        ...(position ? { position } : {}),
        ...(studentId ? { studentId } : {}),
      },
    };
  }

  private async resolveInstitutionIdForSlug(req: Request, slug: string): Promise<string> {
    if (req.institution?.id) {
      return req.institution.id;
    }
    const inst = await this.prisma.institution.findFirst({
      where: { slug: slug.trim(), deletedAt: null },
    });
    if (!inst) {
      throw new UnauthorizedException('Unknown institution');
    }
    return inst.id;
  }

  async getGoogleOAuthAppCredentials(
    institutionSlug: string,
  ): Promise<{ clientId: string; clientSecret: string } | null> {
    const inst = await this.prisma.institution.findFirst({
      where: { slug: institutionSlug.trim(), deletedAt: null },
      select: { settings: true },
    });
    const settings = (inst?.settings ?? {}) as Record<string, unknown>;
    const oauth = settings.oauthGoogle as { clientId?: string; clientSecret?: string } | undefined;
    const clientId = (oauth?.clientId ?? process.env.GOOGLE_CLIENT_ID)?.trim();
    const clientSecret = (oauth?.clientSecret ?? process.env.GOOGLE_CLIENT_SECRET)?.trim();
    if (!clientId || !clientSecret) {
      return null;
    }
    return { clientId, clientSecret };
  }

  async issueSessionForGoogleUser(req: Request, institutionSlug: string, email: string) {
    const institutionId = await this.resolveInstitutionIdForSlug(req, institutionSlug);
    await this.assertInstitutionNotSuspended(institutionId);
    const user = await this.prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        institutionId,
        deletedAt: null,
        isActive: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException('No user for this Google account in this institution');
    }
    if (user.mfaSecret) {
      throw new BadRequestException(
        'MFA is enabled; use password + TOTP instead of Google redirect.',
      );
    }
    return this.buildAuthSession(user, institutionId, false);
  }

  async requestMagicLink(req: Request, dto: MagicLinkRequestDto) {
    const institutionId = await this.resolveInstitutionIdForSlug(req, dto.institutionSlug);
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email, institutionId, deletedAt: null, isActive: true },
    });
    if (!user) {
      return { ok: true as const, delivered: false };
    }
    const plain = randomBytes(24).toString('hex');
    const tokenHash = createHash('sha256').update(plain).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60_000);
    await this.prisma.loginMagicLink.create({
      data: { institutionId, email, tokenHash, expiresAt },
    });
    const webBase = process.env.WEB_PUBLIC_URL?.trim() ?? 'http://localhost:3000';
    const link = `${webBase.replace(/\/$/, '')}/login?magicToken=${encodeURIComponent(plain)}`;
    await this.mail.sendMagicLink(
      user.email,
      'Your UniCore sign-in link',
      `Sign in (valid 15 minutes): ${link}`,
      `<p>Sign in to UniCore</p><p><a href="${link}">Open magic link</a></p><p>This link expires in 15 minutes.</p>`,
    );
    return { ok: true as const, delivered: true };
  }

  async consumeMagicLink(dto: MagicLinkConsumeDto) {
    const tokenHash = createHash('sha256').update(dto.token.trim()).digest('hex');
    const row = await this.prisma.loginMagicLink.findFirst({
      where: { tokenHash, consumedAt: null },
    });
    if (!row || row.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired link');
    }
    await this.assertInstitutionNotSuspended(row.institutionId);
    const user = await this.prisma.user.findFirst({
      where: {
        email: row.email,
        institutionId: row.institutionId,
        deletedAt: null,
        isActive: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid link');
    }
    if (user.mfaSecret) {
      throw new BadRequestException(
        'Passwordless sign-in is disabled while MFA is enabled. Use password + TOTP.',
      );
    }
    await this.prisma.loginMagicLink.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    });
    return this.buildAuthSession(user, user.institutionId, false);
  }

  async login(req: Request, dto: LoginDto) {
    const institutionId = await this.resolveInstitutionId(req, dto);
    await this.assertInstitutionNotSuspended(institutionId);
    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email.toLowerCase(),
        institutionId,
        deletedAt: null,
      },
    });
    if (!user?.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.mfaSecret) {
      if (!dto.mfaToken?.trim()) {
        throw new BadRequestException('Two-factor authentication code required');
      }
      const totpOk = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token: dto.mfaToken.trim(),
        window: 1,
      });
      if (!totpOk) {
        throw new UnauthorizedException('Invalid two-factor code');
      }
    }

    const remember = dto.rememberMe === true;
    return this.buildAuthSession(user, institutionId, remember);
  }

  verifyAccessToken(token: string): JwtAccessPayload {
    return this.jwt.verify<JwtAccessPayload>(token);
  }

  async refresh(refreshToken: string | undefined) {
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }
    let decoded: jwt.JwtPayload;
    try {
      decoded = jwt.verify(refreshToken, this.refreshSecret()) as jwt.JwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (
      decoded.typ !== 'refresh' ||
      typeof decoded.sub !== 'string' ||
      typeof decoded.jti !== 'string'
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (
      this.revokedRefresh.has(decoded.jti) ||
      (await this.redis.isRefreshJtiRevoked(decoded.jti))
    ) {
      throw new UnauthorizedException('Refresh token revoked');
    }
    const institutionId = decoded.institutionId as string;
    await this.assertInstitutionNotSuspended(institutionId);
    const user = await this.prisma.user.findFirst({
      where: { id: decoded.sub, institutionId, deletedAt: null, isActive: true },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const tokenSessionVersion =
      typeof decoded.sessionVersion === 'number' && !Number.isNaN(decoded.sessionVersion)
        ? decoded.sessionVersion
        : 0;
    if (tokenSessionVersion !== user.sessionVersion) {
      throw new UnauthorizedException('Session expired');
    }
    const oldJti = decoded.jti;
    this.revokedRefresh.add(oldJti);
    await this.redis.revokeRefreshJti(oldJti);

    const preferredEntityId =
      typeof decoded.entityId === 'string' && decoded.entityId.trim()
        ? decoded.entityId.trim()
        : null;

    const session = await this.buildAuthSession(user, institutionId, false, {
      entityId: preferredEntityId,
      skipLastLoginTouch: true,
    });

    return { accessToken: session.accessToken, refreshToken: session.refreshToken };
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) {
      return;
    }
    try {
      const decoded = jwt.verify(refreshToken, this.refreshSecret()) as jwt.JwtPayload;
      if (typeof decoded.jti === 'string') {
        this.revokedRefresh.add(decoded.jti);
        await this.redis.revokeRefreshJti(decoded.jti);
      }
    } catch {
      /* ignore */
    }
  }

  refreshCookieName() {
    return REFRESH_COOKIE;
  }

  async validateJwtPayload(payload: JwtAccessPayload): Promise<AuthUser> {
    if (typeof payload.jti === 'string' && payload.jti.length > 0) {
      if (await this.redis.isAccessJtiBlocked(payload.jti)) {
        throw new UnauthorizedException();
      }
    }
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        institutionId: payload.institutionId,
        deletedAt: null,
        isActive: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    const tokenSessionVersion =
      typeof payload.sessionVersion === 'number' && !Number.isNaN(payload.sessionVersion)
        ? payload.sessionVersion
        : 0;
    if (tokenSessionVersion !== user.sessionVersion) {
      throw new UnauthorizedException();
    }
    const permissions = await this.permissionsForUser(user.id, user.institutionId, user.role);
    let preferredEntityId =
      typeof payload.entityId === 'string' && payload.entityId.trim()
        ? payload.entityId.trim()
        : null;
    if (preferredEntityId) {
      const valid = await this.prisma.institutionEntity.findFirst({
        where: { id: preferredEntityId, institutionId: user.institutionId, deletedAt: null },
        select: { id: true, status: true },
      });
      if (!valid || valid.status !== 'ACTIVE') {
        throw new UnauthorizedException('Campus context is no longer active');
      }
    }
    const { entityId, entityScope } = await this.resolveEntityContext(
      user.institutionId,
      user.role,
      permissions,
      preferredEntityId,
    );
    const studentId =
      user.role === 'STUDENT'
        ? await this.resolveLinkedStudentId(user.id, user.institutionId)
        : undefined;
    const position: AuthPosition | undefined = payload.position
      ? {
          code: payload.position.code,
          level: payload.position.level,
          scope: payload.position.scope,
          orgUnitId: payload.position.orgUnitId,
        }
      : await this.resolveActivePosition(user.id, user.institutionId, entityId);
    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      institutionId: user.institutionId,
      entityId,
      entityScope,
      permissions,
      ...(position ? { position } : {}),
      accessJti:
        typeof payload.jti === 'string' && payload.jti.length > 0 ? payload.jti : undefined,
      studentId,
    };
  }

  private async assertCanSwitchToEntity(
    actor: AuthUser,
    institutionId: string,
    entityId: string,
  ): Promise<void> {
    const trimmed = entityId.trim();
    const target = await this.prisma.institutionEntity.findFirst({
      where: { id: trimmed, institutionId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true, type: true },
    });
    if (!target) {
      throw new BadRequestException('Unknown or inactive campus entity');
    }
    if (
      target.type === 'AFFILIATE' &&
      !actor.permissions.includes('*') &&
      !actor.permissions.includes('institutions.write')
    ) {
      throw new ForbiddenException('Cannot switch to an affiliate entity');
    }
    if (actor.permissions.includes('*')) {
      return;
    }
    if (actor.permissions.includes('institutions.write')) {
      return;
    }
    if (actor.role === 'ADMIN') {
      return;
    }
    if (actor.role === 'STUDENT' || actor.role === 'ALUMNI' || actor.role === 'GUARDIAN') {
      throw new ForbiddenException('Entity switch is not available for this account');
    }
    const access = await this.prisma.userEntityAccess.findFirst({
      where: { userId: actor.userId, entityId: trimmed },
      select: { id: true },
    });
    if (!access) {
      throw new ForbiddenException('No access to the requested campus entity');
    }
  }

  /** Issue tokens after enterprise SAML ACS (WP-1.4). */
  async createSessionForSamlUser(userId: string, institutionId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, institutionId, deletedAt: null, isActive: true },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.buildAuthSession(user, institutionId, false);
  }

  async switchEntity(actor: AuthUser, entityId: string, currentRefreshToken?: string) {
    await this.assertCanSwitchToEntity(actor, actor.institutionId, entityId);
    if (currentRefreshToken) {
      try {
        const decoded = jwt.verify(currentRefreshToken, this.refreshSecret()) as jwt.JwtPayload;
        if (decoded.typ === 'refresh' && typeof decoded.jti === 'string') {
          this.revokedRefresh.add(decoded.jti);
          await this.redis.revokeRefreshJti(decoded.jti);
        }
      } catch {
        // Ignore invalid/expired refresh; switch is still authorized by access token.
      }
    }
    if (typeof actor.accessJti === 'string' && actor.accessJti.length > 0) {
      await this.redis.blockAccessJti(actor.accessJti);
    }
    await this.prisma.user.update({
      where: { id: actor.userId },
      data: { sessionVersion: { increment: 1 } },
    });
    const user = await this.prisma.user.findFirst({
      where: {
        id: actor.userId,
        institutionId: actor.institutionId,
        deletedAt: null,
        isActive: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.buildAuthSession(user, actor.institutionId, false, {
      entityId: entityId.trim(),
      skipLastLoginTouch: true,
    });
  }

  async setupTotp(actor: AuthUser) {
    const secret = speakeasy.generateSecret({
      name: `UniCore (${actor.email})`,
      issuer: process.env.TOTP_ISSUER ?? 'UniCore',
      length: 32,
    });
    const otpauthUrl = secret.otpauth_url ?? '';
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
    return { secret: secret.base32, otpauthUrl, qrDataUrl };
  }

  async enableTotp(actor: AuthUser, dto: EnableTotpDto) {
    const ok = speakeasy.totp.verify({
      secret: dto.secret,
      encoding: 'base32',
      token: dto.token,
      window: 1,
    });
    if (!ok) {
      throw new BadRequestException('Invalid authenticator code');
    }
    await this.prisma.user.update({
      where: { id: actor.userId },
      data: { mfaSecret: dto.secret },
    });
    return { ok: true as const };
  }

  async disableTotp(actor: AuthUser, dto: DisableTotpDto) {
    const user = await this.prisma.user.findFirst({
      where: { id: actor.userId, institutionId: actor.institutionId, deletedAt: null },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    const match = await bcrypt.compare(dto.password, user.passwordHash);
    if (!match) {
      throw new UnauthorizedException('Invalid password');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { mfaSecret: null },
    });
    return { ok: true as const };
  }
}
