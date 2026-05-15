import { Controller, Get, HttpCode, HttpException, HttpStatus, Post } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';

/** SAML 2.0 placeholders — full IdP integration is an enterprise follow-up. */
@Controller('auth/saml')
export class SamlAuthController {
  @Public()
  @Get('metadata')
  metadata() {
    return {
      implemented: false,
      message: 'SAML metadata is not configured. Use institution SSO settings + passport-saml in a follow-up.',
    };
  }

  @Public()
  @Post('acs')
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  acs() {
    throw new HttpException(
      {
        implemented: false,
        message: 'SAML ACS not implemented. Configure IdP certificates and ACS URL per institution.',
      },
      HttpStatus.NOT_IMPLEMENTED,
    );
  }
}
