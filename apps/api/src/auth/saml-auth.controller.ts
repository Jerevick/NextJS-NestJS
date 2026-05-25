import { Controller, Get, HttpCode, Post, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { SamlAuthService } from './saml-auth.service';

@ApiTags('auth-saml')
@Controller('auth/saml')
export class SamlAuthController {
  constructor(private readonly saml: SamlAuthService) {}

  @Public()
  @Get('metadata')
  @ApiOperation({ summary: 'SP metadata XML for institution IdP configuration' })
  async metadata(@Query('institution') institution: string, @Res() res: Response) {
    if (!institution?.trim()) {
      res.status(400).json({ message: 'institution query (slug) is required' });
      return;
    }
    const xml = await this.saml.getMetadataXml(institution.trim());
    res.type('application/xml').send(xml);
  }

  @Public()
  @Get('login')
  @ApiOperation({ summary: 'Redirect browser to IdP SSO URL' })
  async login(@Query('institution') institution: string, @Res() res: Response) {
    if (!institution?.trim()) {
      res.status(400).json({ message: 'institution query (slug) is required' });
      return;
    }
    await this.saml.redirectToIdp(institution.trim(), res);
  }

  @Public()
  @Post('acs')
  @HttpCode(302)
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @SkipThrottle({ default: false })
  @ApiOperation({ summary: 'SAML assertion consumer — issues JWT and redirects to web app' })
  async acs(@Req() req: Request, @Res() res: Response) {
    await this.saml.handleAcs(req, res);
  }
}
