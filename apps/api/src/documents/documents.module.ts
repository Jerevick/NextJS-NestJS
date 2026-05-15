import { Module } from '@nestjs/common';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { DocumentsController } from './documents.controller';
import { DocumentsPublicController } from './documents-public.controller';
import { DocumentsRepository } from './documents.repository';
import { DocumentsService } from './documents.service';

@Module({
  controllers: [DocumentsPublicController, DocumentsController],
  providers: [DocumentsService, DocumentsRepository, PermissionsGuard, AnyPermissionsGuard],
})
export class DocumentsModule {}
