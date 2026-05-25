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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ResourceEntityId } from '../common/decorators/resource-entity-id.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import type { AuthUser } from '../auth/auth.types';
import { CreateStudentDto } from './dto/create-student.dto';
import { ImportStudentsBatchDto } from './dto/import-students-batch.dto';
import { ListStudentsQueryDto } from './dto/list-students-query.dto';
import { ConfirmGraduationDto } from './dto/confirm-graduation.dto';
import { InitiatePermanentDeletionDto } from './deletion/dto/initiate-permanent-deletion.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { QueueStudentCsvImportDto } from './dto/queue-student-csv-import.dto';
import { StudentCsvImportService } from './student-csv-import.service';
import { StudentsService } from './students.service';

@Controller('students')
@UseGuards(PermissionsGuard)
export class StudentsController {
  constructor(
    private readonly students: StudentsService,
    private readonly csvImports: StudentCsvImportService,
  ) {}

  @Get()
  @RequirePermissions('students.read')
  list(@CurrentUser() user: AuthUser, @Query() query: ListStudentsQueryDto) {
    return this.students.list(user, query);
  }

  @Post('import-csv-queue')
  @RequirePermissions('students.write')
  queueCsvImport(@CurrentUser() user: AuthUser, @Body() dto: QueueStudentCsvImportDto) {
    return this.csvImports.queueJob(user, dto);
  }

  @Get('import-csv-queue/:jobId')
  @RequirePermissions('students.write')
  getCsvImportJob(@CurrentUser() user: AuthUser, @Param('jobId') jobId: string) {
    return this.csvImports.getJob(user, jobId);
  }

  @Post('import-batch')
  @RequirePermissions('students.write')
  importBatch(@CurrentUser() user: AuthUser, @Body() dto: ImportStudentsBatchDto) {
    return this.students.importBatch(user, dto);
  }

  @Post(':id/confirm-graduation')
  @ResourceEntityId('id', 'student')
  @RequirePermissions('students.write')
  confirmGraduation(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ConfirmGraduationDto,
  ) {
    return this.students.confirmGraduation(user, id, dto);
  }

  @Post(':id/permanent-deletion')
  @RequirePermissions('students.permanent_delete')
  initiatePermanentDeletion(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: InitiatePermanentDeletionDto,
  ) {
    return this.students.initiatePermanentDeletion(user, id, dto);
  }

  @Get(':id/status-changes')
  @RequirePermissions('students.read')
  listStatusChanges(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.students.listStatusChangeLogs(user, id);
  }

  @Get(':id')
  @ResourceEntityId('id', 'student')
  @RequirePermissions('students.read')
  getById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.students.getById(user, id);
  }

  @Post()
  @RequirePermissions('students.write')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStudentDto) {
    return this.students.create(user, dto);
  }

  @Patch(':id')
  @ResourceEntityId('id', 'student')
  @RequirePermissions('students.write')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateStudentDto) {
    return this.students.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('students.write')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.students.remove(user, id);
  }
}
