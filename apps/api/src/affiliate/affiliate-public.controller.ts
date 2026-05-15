import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { AffiliateService } from './affiliate.service';
import { VerifyStudentEnrollmentDto } from './dto/verify-student-enrollment.dto';
import { VerifyTranscriptDto } from './dto/verify-transcript.dto';

@ApiTags('affiliate-public')
@Controller('public/affiliate')
export class AffiliatePublicController {
  constructor(private readonly affiliate: AffiliateService) {}

  @Public()
  @Post('verify-student-enrollment')
  @HttpCode(200)
  verifyStudentEnrollment(
    @Body() dto: VerifyStudentEnrollmentDto,
    @Headers('x-affiliate-key') apiKey?: string,
  ): Promise<{ enrolled: boolean; programme: string }> {
    return this.affiliate.verifyStudentEnrollment(dto.institutionSlug, dto.studentNumber, apiKey);
  }

  @Public()
  @Post('verify-transcript')
  @HttpCode(200)
  verifyTranscript(
    @Body() dto: VerifyTranscriptDto,
    @Headers('x-affiliate-key') apiKey?: string,
  ): Promise<{ valid: boolean; issuedAt: string; institution: string; type?: string }> {
    return this.affiliate.verifyTranscriptCode(dto.institutionSlug, dto.code, apiKey);
  }
}
