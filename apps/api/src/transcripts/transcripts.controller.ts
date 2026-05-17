import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { StudentRecordWrite } from '../common/decorators/student-record-write.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { GenerateTranscriptDto } from './dto/generate-transcript.dto';
import { ListTranscriptsQueryDto } from './dto/list-transcripts-query.dto';
import { TranscriptsService } from './transcripts.service';

@Controller('transcripts')
@UseGuards(PermissionsGuard)
export class TranscriptsController {
  constructor(private readonly transcripts: TranscriptsService) {}

  @Get('verify/:hash')
  @Public()
  verify(@Param('hash') hash: string) {
    return this.transcripts.verifyByHash(hash);
  }

  @Get()
  @RequirePermissions('students.read')
  list(@CurrentUser() user: AuthUser, @Query() query: ListTranscriptsQueryDto) {
    return this.transcripts.list(user, query);
  }

  @Get(':id/pdf')
  @RequirePermissions('students.read')
  @Header('Content-Type', 'application/pdf')
  async downloadPdf(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const bytes = await this.transcripts.downloadPdf(user, id);
    return new StreamableFile(Buffer.from(bytes), {
      type: 'application/pdf',
      disposition: `attachment; filename="transcript-${id}.pdf"`,
    });
  }

  @Get(':id')
  @RequirePermissions('students.read')
  getById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.transcripts.getById(user, id);
  }

  @Post()
  @RequirePermissions('students.write')
  @StudentRecordWrite({
    mode: 'bodyStudentId',
    studentIdField: 'studentId',
    recordDate: { kind: 'now' },
  })
  generate(@CurrentUser() user: AuthUser, @Body() dto: GenerateTranscriptDto) {
    return this.transcripts.generate(user, dto);
  }
}
