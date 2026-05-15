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
import { PermissionsGuard } from '../common/guards/permissions.guard';
import type { AuthUser } from '../auth/auth.types';
import { CreateStudentDto } from './dto/create-student.dto';
import { ListStudentsQueryDto } from './dto/list-students-query.dto';
import { InitiatePermanentDeletionDto } from './deletion/dto/initiate-permanent-deletion.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { StudentsService } from './students.service';

@Controller('students')
@UseGuards(PermissionsGuard)
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  @RequirePermissions('students.read')
  list(@CurrentUser() user: AuthUser, @Query() query: ListStudentsQueryDto) {
    return this.students.list(user, query);
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
