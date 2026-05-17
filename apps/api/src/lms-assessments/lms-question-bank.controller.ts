import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CreateLmsQuestionBankDto } from './dto/create-lms-question-bank.dto';
import { CreateLmsQuestionBankItemDto } from './dto/create-lms-question-bank-item.dto';
import { UpdateLmsQuestionBankDto } from './dto/update-lms-question-bank.dto';
import { UpdateLmsQuestionBankItemDto } from './dto/update-lms-question-bank-item.dto';
import { LmsQuestionBankService } from './lms-question-bank.service';

@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller('lms/question-banks')
@UseGuards(PermissionsGuard)
export class LmsQuestionBankController {
  constructor(private readonly banks: LmsQuestionBankService) {}

  @Get()
  @RequirePermissions('lms.write')
  list(@CurrentUser() user: AuthUser) {
    return this.banks.list(user);
  }

  @Post()
  @RequirePermissions('lms.write')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLmsQuestionBankDto) {
    return this.banks.create(user, dto);
  }

  @Patch('items/:itemId')
  @RequirePermissions('lms.write')
  updateItem(
    @CurrentUser() user: AuthUser,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateLmsQuestionBankItemDto,
  ) {
    return this.banks.updateItem(user, itemId, dto);
  }

  @Delete('items/:itemId')
  @RequirePermissions('lms.write')
  removeItem(@CurrentUser() user: AuthUser, @Param('itemId') itemId: string) {
    return this.banks.removeItem(user, itemId);
  }

  @Get(':bankId/items')
  @RequirePermissions('lms.write')
  listItems(@CurrentUser() user: AuthUser, @Param('bankId') bankId: string) {
    return this.banks.listItems(user, bankId);
  }

  @Post(':bankId/items')
  @RequirePermissions('lms.write')
  createItem(
    @CurrentUser() user: AuthUser,
    @Param('bankId') bankId: string,
    @Body() dto: CreateLmsQuestionBankItemDto,
  ) {
    return this.banks.createItem(user, bankId, dto);
  }

  @Get(':bankId')
  @RequirePermissions('lms.write')
  get(@CurrentUser() user: AuthUser, @Param('bankId') bankId: string) {
    return this.banks.get(user, bankId);
  }

  @Patch(':bankId')
  @RequirePermissions('lms.write')
  update(
    @CurrentUser() user: AuthUser,
    @Param('bankId') bankId: string,
    @Body() dto: UpdateLmsQuestionBankDto,
  ) {
    return this.banks.update(user, bankId, dto);
  }

  @Delete(':bankId')
  @RequirePermissions('lms.write')
  remove(@CurrentUser() user: AuthUser, @Param('bankId') bankId: string) {
    return this.banks.remove(user, bankId);
  }
}
