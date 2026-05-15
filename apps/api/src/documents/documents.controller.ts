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
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireAnyPermissions } from '../common/decorators/require-any-permissions.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CreateDocumentDto } from './dto/create-document.dto';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { UpdateDocumentTemplateDto } from './dto/update-document-template.dto';
import { UpsertDocumentTemplateDto } from './dto/upsert-document-template.dto';
import { DocumentsService } from './documents.service';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get('templates')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('documents.read', 'documents.write')
  listTemplates(@CurrentUser() user: AuthUser) {
    return this.documents.listTemplates(user);
  }

  @Post('templates')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('documents.write')
  upsertTemplate(@CurrentUser() user: AuthUser, @Body() dto: UpsertDocumentTemplateDto) {
    return this.documents.upsertTemplate(user, dto);
  }

  @Patch('templates/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('documents.write')
  updateTemplate(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentTemplateDto,
  ) {
    return this.documents.updateTemplate(user, id, dto);
  }

  @Delete('templates/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('documents.write')
  removeTemplate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.documents.removeTemplate(user, id);
  }

  @Get()
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('documents.read', 'documents.write')
  list(@CurrentUser() user: AuthUser, @Query() query: ListDocumentsQueryDto) {
    return this.documents.list(user, query);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('documents.write')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDocumentDto) {
    return this.documents.create(user, dto);
  }

  @Get(':id')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('documents.read', 'documents.write')
  getById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.documents.getById(user, id);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('documents.write')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateDocumentDto) {
    return this.documents.update(user, id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('documents.write')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.documents.remove(user, id);
  }
}
