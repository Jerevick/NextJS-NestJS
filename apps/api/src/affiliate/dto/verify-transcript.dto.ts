import { IsString, MaxLength, MinLength } from 'class-validator';

export class VerifyTranscriptDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  institutionSlug!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(256)
  code!: string;
}
