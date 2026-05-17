import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireFinanceDirector } from '../common/decorators/require-finance-director.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';
import { UpdateFeeStructureDto } from './dto/update-fee-structure.dto';
import { FinanceDirectorGuard } from './guards/finance-director.guard';
import { FinanceService } from './finance.service';

@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller('finance/fee-structures')
@UseGuards(PermissionsGuard, FinanceDirectorGuard)
export class FinanceFeeStructuresController {
  constructor(private readonly finance: FinanceService) {}

  @Get()
  @RequirePermissions('finance.read')
  list(@CurrentUser() user: AuthUser) {
    return this.finance.listFeeStructures(user);
  }

  @Post()
  @RequirePermissions('finance.write')
  @RequireFinanceDirector()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateFeeStructureDto) {
    return this.finance.createFeeStructure(user, dto);
  }

  @Patch(':id')
  @RequirePermissions('finance.write')
  @RequireFinanceDirector()
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateFeeStructureDto,
  ) {
    return this.finance.updateFeeStructure(user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('finance.write')
  @RequireFinanceDirector()
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.finance.deleteFeeStructure(user, id);
  }
}
