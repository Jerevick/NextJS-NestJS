import { Module } from '@nestjs/common';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { TranscriptsController } from './transcripts.controller';
import { TranscriptsRepository } from './transcripts.repository';
import { TranscriptsService } from './transcripts.service';

@Module({
  controllers: [TranscriptsController],
  providers: [TranscriptsService, TranscriptsRepository, PermissionsGuard],
})
export class TranscriptsModule {}
