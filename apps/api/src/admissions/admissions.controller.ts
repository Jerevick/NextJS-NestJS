import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireAnyPermissions } from '../common/decorators/require-any-permissions.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AdmissionsService } from './admissions.service';
import { CreateAdmissionCycleDto } from './dto/create-admission-cycle.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { CreateApplicationFormDto } from './dto/create-application-form.dto';
import { ListApplicationsQueryDto } from './dto/list-applications-query.dto';
import { ListCyclesQueryDto } from './dto/list-cycles-query.dto';
import { UpdateAdmissionCycleDto } from './dto/update-admission-cycle.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { UpdateApplicationFormDto } from './dto/update-application-form.dto';

@Controller('admissions')
export class AdmissionsController {
  constructor(private readonly admissions: AdmissionsService) {}

  @Get('applications')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('admissions.read', 'admissions.write')
  listApplications(@CurrentUser() user: AuthUser, @Query() query: ListApplicationsQueryDto) {
    return this.admissions.listApplications(user, query);
  }

  @Post('applications')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('admissions.write')
  createApplication(@CurrentUser() user: AuthUser, @Body() dto: CreateApplicationDto) {
    return this.admissions.createApplication(user, dto);
  }

  @Get('applications/:applicationId')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('admissions.read', 'admissions.write')
  getApplication(@CurrentUser() user: AuthUser, @Param('applicationId') applicationId: string) {
    return this.admissions.getApplication(user, applicationId);
  }

  @Get('applications/:applicationId/offer-letter/pdf')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('admissions.read', 'admissions.write')
  @Header('Content-Type', 'application/pdf')
  async offerLetterPdf(
    @CurrentUser() user: AuthUser,
    @Param('applicationId') applicationId: string,
  ) {
    const bytes = await this.admissions.offerLetterPdf(user, applicationId);
    return new StreamableFile(Buffer.from(bytes), {
      type: 'application/pdf',
      disposition: `attachment; filename="offer-letter-${applicationId}.pdf"`,
    });
  }

  @Get('applications/:applicationId/offer-letter')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('admissions.read', 'admissions.write')
  @Header('Content-Type', 'text/html; charset=utf-8')
  offerLetterHtml(@CurrentUser() user: AuthUser, @Param('applicationId') applicationId: string) {
    return this.admissions.offerLetterHtml(user, applicationId);
  }

  @Patch('applications/:applicationId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('admissions.write')
  updateApplication(
    @CurrentUser() user: AuthUser,
    @Param('applicationId') applicationId: string,
    @Body() dto: UpdateApplicationDto,
  ) {
    return this.admissions.updateApplication(user, applicationId, dto);
  }

  @Post('applications/:applicationId/enroll-student')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('admissions.write')
  enrollStudent(@CurrentUser() user: AuthUser, @Param('applicationId') applicationId: string) {
    return this.admissions.enrollStudentFromApplication(user, applicationId);
  }

  @Delete('applications/:applicationId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('admissions.write')
  removeApplication(@CurrentUser() user: AuthUser, @Param('applicationId') applicationId: string) {
    return this.admissions.removeApplication(user, applicationId);
  }

  @Get('cycles')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('admissions.read', 'admissions.write')
  listCycles(@CurrentUser() user: AuthUser, @Query() query: ListCyclesQueryDto) {
    return this.admissions.listCycles(user, query);
  }

  @Post('cycles')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('admissions.write')
  createCycle(@CurrentUser() user: AuthUser, @Body() dto: CreateAdmissionCycleDto) {
    return this.admissions.createCycle(user, dto);
  }

  @Get('cycles/:cycleId/forms')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('admissions.read', 'admissions.write')
  listForms(@CurrentUser() user: AuthUser, @Param('cycleId') cycleId: string) {
    return this.admissions.listForms(user, cycleId);
  }

  @Post('cycles/:cycleId/forms')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('admissions.write')
  createForm(
    @CurrentUser() user: AuthUser,
    @Param('cycleId') cycleId: string,
    @Body() dto: CreateApplicationFormDto,
  ) {
    return this.admissions.createForm(user, cycleId, dto);
  }

  @Get('cycles/:cycleId')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('admissions.read', 'admissions.write')
  getCycle(@CurrentUser() user: AuthUser, @Param('cycleId') cycleId: string) {
    return this.admissions.getCycle(user, cycleId);
  }

  @Patch('cycles/:cycleId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('admissions.write')
  updateCycle(
    @CurrentUser() user: AuthUser,
    @Param('cycleId') cycleId: string,
    @Body() dto: UpdateAdmissionCycleDto,
  ) {
    return this.admissions.updateCycle(user, cycleId, dto);
  }

  @Delete('cycles/:cycleId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('admissions.write')
  removeCycle(@CurrentUser() user: AuthUser, @Param('cycleId') cycleId: string) {
    return this.admissions.removeCycle(user, cycleId);
  }

  @Get('forms/:formId')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('admissions.read', 'admissions.write')
  getForm(@CurrentUser() user: AuthUser, @Param('formId') formId: string) {
    return this.admissions.getForm(user, formId);
  }

  @Patch('forms/:formId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('admissions.write')
  updateForm(
    @CurrentUser() user: AuthUser,
    @Param('formId') formId: string,
    @Body() dto: UpdateApplicationFormDto,
  ) {
    return this.admissions.updateForm(user, formId, dto);
  }

  @Delete('forms/:formId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('admissions.write')
  removeForm(@CurrentUser() user: AuthUser, @Param('formId') formId: string) {
    return this.admissions.removeForm(user, formId);
  }
}
