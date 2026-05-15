import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireAnyPermissions } from '../common/decorators/require-any-permissions.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { ListInstitutionsQueryDto } from './dto/list-institutions-query.dto';
import { UpdateInstitutionModulesDto } from './dto/update-institution-modules.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import { InstitutionsService } from './institutions.service';

@ApiTags('institutions')
@ApiBearerAuth('JWT')
@Controller('institutions')
export class InstitutionsController {
  constructor(private readonly institutions: InstitutionsService) {}

  @Get()
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('institutions.read', 'institutions.write')
  list(@CurrentUser() user: AuthUser, @Query() query: ListInstitutionsQueryDto) {
    return this.institutions.list(user, query);
  }

  @Get(':id')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('institutions.read', 'institutions.write')
  getById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.institutions.getById(user, id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('institutions.write')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateInstitutionDto) {
    return this.institutions.create(user, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('institutions.write')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateInstitutionDto) {
    return this.institutions.update(user, id, dto);
  }

  @Patch(':id/modules')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('institutions.write')
  updateModules(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateInstitutionModulesDto,
  ) {
    return this.institutions.updateModules(user, id, dto);
  }
}
