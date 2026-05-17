import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateLmsQuestionBankDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;
}
