import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CustomFormStatus, CustomFormType } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireAnyPermissions } from '../common/decorators/require-any-permissions.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CustomFormsService } from './custom-forms.service';
import {
  CreateCustomFormDto,
  SubmitCustomFormDto,
  UpdateCustomFormDto,
} from './dto/custom-form.dto';

@ApiTags('customization-forms')
@ApiBearerAuth('JWT')
@Controller('customization/forms')
@UseGuards(PermissionsGuard)
export class CustomFormsController {
  constructor(private readonly forms: CustomFormsService) {}

  @Get()
  @RequirePermissions('institutions.write')
  list(
    @CurrentUser() user: AuthUser,
    @Query('formType') formType?: CustomFormType,
    @Query('status') status?: CustomFormStatus,
    @Query('entityId') entityId?: string,
  ) {
    return this.forms.list(user, { formType, status, entityId });
  }

  @Post()
  @RequirePermissions('institutions.write')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCustomFormDto) {
    return this.forms.create(user, dto);
  }

  @Get(':id')
  @RequirePermissions('institutions.write')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.forms.get(user, id);
  }

  @Patch(':id')
  @RequirePermissions('institutions.write')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCustomFormDto) {
    return this.forms.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('institutions.write')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.forms.remove(user, id);
  }

  @Post(':id/submit')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('institutions.read', 'institutions.write')
  @ApiOperation({ summary: 'Submit responses for a published form' })
  submit(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SubmitCustomFormDto) {
    return this.forms.submit(user, id, dto);
  }

  @Get(':id/analytics')
  @RequirePermissions('institutions.write')
  analytics(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.forms.analytics(user, id);
  }
}
