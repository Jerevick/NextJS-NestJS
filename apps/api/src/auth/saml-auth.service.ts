import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { SAML, type SamlConfig } from '@node-saml/node-saml';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import {
  encryptSamlConfig,
  parseInstitutionAuthSettings,
  resolveSamlConfig,
  type InstitutionSamlConfig,
} from './saml-settings.util';

@Injectable()
export class SamlAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  private apiPublicUrl(): string {
    return (
      process.env.API_PUBLIC_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      'http://localhost:4000'
    ).replace(/\/$/, '');
  }

  private async loadInstitution(slug: string) {
    const inst = await this.prisma.institution.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true, slug: true, name: true, status: true, settings: true },
    });
    if (!inst) {
      throw new NotFoundException('Institution not found');
    }
    if (inst.status === 'SUSPENDED') {
      throw new UnauthorizedException('Institution is suspended');
    }
    return inst;
  }

  private buildSaml(inst: { slug: string }, cfg: InstitutionSamlConfig): SAML {
    const callbackUrl = cfg.audience ?? `${this.apiPublicUrl()}/auth/saml/acs`;
    const samlConfig: SamlConfig = {
      entryPoint: cfg.entryPoint,
      issuer: cfg.issuer,
      idpCert: cfg.idpCert,
      callbackUrl,
      audience: callbackUrl,
      wantAssertionsSigned: cfg.wantAssertionsSigned ?? true,
      identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    };
    return new SAML(samlConfig);
  }

  async getMetadataXml(institutionSlug: string): Promise<string> {
    const inst = await this.loadInstitution(institutionSlug);
    const authSettings = parseInstitutionAuthSettings(inst.settings);
    const cfg = resolveSamlConfig(authSettings);
    if (!cfg) {
      throw new BadRequestException('SAML is not configured for this institution');
    }
    const saml = this.buildSaml(inst, cfg);
    return saml.generateServiceProviderMetadata(cfg.idpCert, cfg.idpCert);
  }

  async redirectToIdp(institutionSlug: string, res: Response): Promise<void> {
    const inst = await this.loadInstitution(institutionSlug);
    const authSettings = parseInstitutionAuthSettings(inst.settings);
    const cfg = resolveSamlConfig(authSettings);
    if (!cfg) {
      throw new BadRequestException('SAML is not configured for this institution');
    }
    const saml = this.buildSaml(inst, cfg);
    const url = await saml.getAuthorizeUrlAsync('', undefined, {});
    res.redirect(url);
  }

  async handleAcs(req: Request, res: Response): Promise<void> {
    const institutionSlug =
      typeof req.body?.RelayState === 'string' && req.body.RelayState.trim()
        ? req.body.RelayState.trim()
        : typeof req.query?.institution === 'string'
          ? req.query.institution
          : undefined;
    if (!institutionSlug) {
      throw new BadRequestException('RelayState or institution query required');
    }
    const inst = await this.loadInstitution(institutionSlug);
    const authSettings = parseInstitutionAuthSettings(inst.settings);
    const cfg = resolveSamlConfig(authSettings);
    if (!cfg) {
      throw new BadRequestException('SAML is not configured');
    }
    const saml = this.buildSaml(inst, cfg);
    const { profile } = await saml.validatePostResponseAsync(req.body);
    const email =
      (profile?.email as string | undefined) ?? (profile?.nameID as string | undefined)?.toString();
    if (!email) {
      throw new UnauthorizedException('SAML assertion did not include an email');
    }
    const user = await this.prisma.user.findFirst({
      where: {
        institutionId: inst.id,
        email: email.toLowerCase(),
        deletedAt: null,
        isActive: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException('No active user for this SAML identity');
    }
    const session = await this.auth.createSessionForSamlUser(user.id, inst.id);
    const webUrl = (process.env.WEB_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
    const redirect = new URL('/api/auth/callback/saml', webUrl);
    redirect.searchParams.set('accessToken', session.accessToken);
    redirect.searchParams.set('refreshToken', session.refreshToken);
    res.redirect(redirect.toString());
  }

  /** Admin helper — store encrypted SAML config on institution.settings.saml */
  async upsertSamlConfig(
    institutionId: string,
    config: InstitutionSamlConfig,
  ): Promise<{ ok: true }> {
    const inst = await this.prisma.institution.findFirst({
      where: { id: institutionId, deletedAt: null },
      select: { settings: true },
    });
    if (!inst) {
      throw new NotFoundException('Institution not found');
    }
    const current = parseInstitutionAuthSettings(inst.settings);
    const next = {
      ...current,
      ssoProvider: 'SAML' as const,
      saml: encryptSamlConfig(config),
    };
    await this.prisma.institution.update({
      where: { id: institutionId },
      data: { settings: next as object },
    });
    return { ok: true };
  }
}
