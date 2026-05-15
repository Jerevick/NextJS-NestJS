import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { DocumentsService } from './documents.service';

@Controller('documents')
export class DocumentsPublicController {
  constructor(private readonly documents: DocumentsService) {}

  @Get('verify/:verificationCode')
  @Public()
  verify(@Param('verificationCode') verificationCode: string) {
    return this.documents.verifyByCode(verificationCode);
  }
}
