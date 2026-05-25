import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import * as jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthRegistrationService } from './auth-registration.service';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import type { AuthUser } from './auth.types';
import { DisableTotpDto } from './dto/disable-totp.dto';
import { EnableTotpDto } from './dto/enable-totp.dto';
import { LoginDto } from './dto/login.dto';
import { MagicLinkConsumeDto } from './dto/magic-link-consume.dto';
import { MagicLinkRequestDto } from './dto/magic-link-request.dto';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { SwitchEntityDto } from './dto/switch-entity.dto';
import { parseRegisterInstitutionBody } from './register-institution-body.util';

function refreshCookieMaxAgeMs(refreshToken: string): number {
  const decoded = jwt.decode(refreshToken) as { exp?: number } | null;
  if (decoded?.exp) {
    return Math.max(60_000, decoded.exp * 1000 - Date.now());
  }
  return 7 * 24 * 60 * 60 * 1000;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly registration: AuthRegistrationService,
  ) {}

  @Post('mfa/setup')
  mfaSetup(@CurrentUser() user: AuthUser) {
    return this.auth.setupTotp(user);
  }

  @Post('mfa/enable')
  mfaEnable(@CurrentUser() user: AuthUser, @Body() dto: EnableTotpDto) {
    return this.auth.enableTotp(user, dto);
  }

  @Post('mfa/disable')
  mfaDisable(@CurrentUser() user: AuthUser, @Body() dto: DisableTotpDto) {
    return this.auth.disableTotp(user, dto);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('institutions')
  listSigninInstitutions() {
    return this.auth.listSigninInstitutions();
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @Post('magic-link/request')
  requestMagicLink(@Req() req: Request, @Body() dto: MagicLinkRequestDto) {
    return this.auth.requestMagicLink(req, dto);
  }

  @Public()
  @Post('magic-link/consume')
  async consumeMagicLink(
    @Body() dto: MagicLinkConsumeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } = await this.auth.consumeMagicLink(dto);
    res.cookie(this.auth.refreshCookieName(), refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: refreshCookieMaxAgeMs(refreshToken),
    });
    return { accessToken, refreshToken, user };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @Post('register/institution')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'logo', maxCount: 1 },
        { name: 'accreditationEvidence', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: 10 * 1024 * 1024 },
      },
    ),
  )
  registerInstitution(
    @Req() req: Request,
    @Body() body: Record<string, string>,
    @UploadedFiles()
    files: {
      logo?: Express.Multer.File[];
      accreditationEvidence?: Express.Multer.File[];
    },
  ) {
    const dto = parseRegisterInstitutionBody(body);
    return this.registration.submitInstitution(req, dto, {
      logo: files.logo?.[0],
      accreditationEvidence: files.accreditationEvidence?.[0],
    });
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @Post('register/institution/:requestId/details')
  getEditableInstitutionRegistration(
    @Param('requestId') requestId: string,
    @Body() body: { email?: string },
  ) {
    return this.registration.getEditableInstitutionRegistration(requestId, body.email);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @Patch('register/institution/:requestId')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'logo', maxCount: 1 },
        { name: 'accreditationEvidence', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: 10 * 1024 * 1024 },
      },
    ),
  )
  updateInstitutionRegistration(
    @Param('requestId') requestId: string,
    @Req() req: Request,
    @Body() body: Record<string, string>,
    @UploadedFiles()
    files: {
      logo?: Express.Multer.File[];
      accreditationEvidence?: Express.Multer.File[];
    },
  ) {
    const verificationEmail = body.verificationEmail;
    const dto = parseRegisterInstitutionBody(body);
    return this.registration.updateInstitutionRegistration(req, requestId, verificationEmail, dto, {
      logo: files.logo?.[0],
      accreditationEvidence: files.accreditationEvidence?.[0],
    });
  }

  @Public()
  @Throttle({ default: { limit: 15, ttl: 900_000 } })
  @Get('register/institution/:requestId/status')
  trackInstitutionRegistration(@Param('requestId') requestId: string) {
    return this.registration.getRegistrationTrackingStatus(requestId);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @Post('password-reset/request')
  requestPasswordReset(@Req() req: Request, @Body() dto: PasswordResetRequestDto) {
    return this.registration.requestPasswordReset(req, dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @Post('password-reset/confirm')
  confirmPasswordReset(@Body() dto: PasswordResetConfirmDto) {
    return this.registration.confirmPasswordReset(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @Post('login')
  async login(
    @Req() req: Request,
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } = await this.auth.login(req, dto);
    res.cookie(this.auth.refreshCookieName(), refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: refreshCookieMaxAgeMs(refreshToken),
    });
    return { accessToken, refreshToken, user };
  }

  @Public()
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[this.auth.refreshCookieName()] as string | undefined;
    const { accessToken, refreshToken } = await this.auth.refresh(token);
    res.cookie(this.auth.refreshCookieName(), refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: refreshCookieMaxAgeMs(refreshToken),
    });
    return { accessToken, refreshToken };
  }

  @Public()
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[this.auth.refreshCookieName()] as string | undefined;
    await this.auth.logout(token);
    res.clearCookie(this.auth.refreshCookieName(), { path: '/' });
    return { ok: true };
  }

  @Post('password/change')
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user, dto);
  }

  @SkipThrottle()
  @Get('me')
  me(@CurrentUser() user: AuthUser | undefined) {
    if (!user) {
      return { user: null };
    }
    return {
      user: {
        userId: user.userId,
        email: user.email,
        role: user.role,
        institutionId: user.institutionId,
        entityId: user.entityId,
        entityScope: user.entityScope,
        permissions: user.permissions,
        position: user.position,
        studentId: user.studentId,
        institutionTermsAccepted: user.institutionTermsAccepted,
        forcePasswordChange: user.forcePasswordChange,
      },
    };
  }

  @Post('switch-entity')
  async switchEntity(
    @CurrentUser() actor: AuthUser,
    @Body() dto: SwitchEntityDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const currentRefresh = req.cookies?.[this.auth.refreshCookieName()] as string | undefined;
    const { accessToken, refreshToken, user } = await this.auth.switchEntity(
      actor,
      dto.entityId,
      currentRefresh,
    );
    res.cookie(this.auth.refreshCookieName(), refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: refreshCookieMaxAgeMs(refreshToken),
    });
    return { accessToken, refreshToken, user };
  }
}
