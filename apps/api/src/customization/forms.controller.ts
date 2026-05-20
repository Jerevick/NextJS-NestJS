import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequireAnyPermissions } from '../common/decorators/require-any-permissions.decorator';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { CustomFormsService } from './custom-forms.service';
import { SubmitCustomFormDto } from './dto/custom-form.dto';

/**
 * Master-prompt route alias: `POST /forms/:id/submit`.
 * Implementation delegates to {@link CustomFormsService}.
 */
@ApiTags('forms')
@Controller('forms')
export class FormsController {
  constructor(private readonly forms: CustomFormsService) {}

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Published form schema (for rendering)' })
  getPublished(@Param('id') id: string) {
    return this.forms.getPublishedSchema(id);
  }

  @Post(':id/submit')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('institutions.read', 'institutions.write')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Submit form responses with schema validation' })
  submit(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SubmitCustomFormDto) {
    return this.forms.submit(user, id, dto);
  }
}
