import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireAnyPermissions } from '../common/decorators/require-any-permissions.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CustomizationService } from './customization.service';
import {
  PatchBrandingDto,
  PatchEntitySettingsDto,
  PatchInstitutionSettingsDto,
} from './dto/patch-settings.dto';

@ApiTags('customization')
@ApiBearerAuth('JWT')
@Controller('customization')
export class CustomizationController {
  constructor(private readonly customization: CustomizationService) {}

  @Get('settings')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('institutions.read', 'institutions.write')
  @ApiOperation({ summary: 'List effective settings (entity → institution → platform)' })
  listSettings(@CurrentUser() user: AuthUser, @Query('entityId') entityId?: string) {
    return this.customization.listEffectiveSettings(user, entityId);
  }

  @Get('settings/:key')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('institutions.read', 'institutions.write')
  getSetting(
    @CurrentUser() user: AuthUser,
    @Param('key') key: string,
    @Query('entityId') entityId?: string,
  ) {
    return this.customization.getEffectiveSetting(user, decodeURIComponent(key), entityId);
  }

  @Get('branding')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('institutions.read', 'institutions.write')
  getBranding(@CurrentUser() user: AuthUser, @Query('entityId') entityId?: string) {
    return this.customization.getBranding(user, entityId);
  }

  @Patch('settings/institution')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('institutions.write')
  patchInstitution(@CurrentUser() user: AuthUser, @Body() dto: PatchInstitutionSettingsDto) {
    return this.customization.patchInstitutionSettings(user, dto.patch);
  }

  @Patch('settings/entity/:entityId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('institutions.write')
  patchEntity(
    @CurrentUser() user: AuthUser,
    @Param('entityId') entityId: string,
    @Body() dto: PatchEntitySettingsDto,
  ) {
    return this.customization.patchEntitySettings(user, entityId, dto.patch);
  }

  @Patch('branding')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('institutions.write')
  patchBranding(
    @CurrentUser() user: AuthUser,
    @Body() dto: PatchBrandingDto,
    @Query('entityId') entityId?: string,
  ) {
    return this.customization.patchBranding(user, dto, entityId);
  }

  @Post('branding/logo')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('institutions.write')
  @UseInterceptors(FileInterceptor('file'))
  uploadLogo(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
    @Query('entityId') entityId?: string,
  ) {
    return this.customization.uploadBrandingLogo(user, file, entityId);
  }
}
