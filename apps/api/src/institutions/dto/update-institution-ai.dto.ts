import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateInstitutionAiDto {
  @IsOptional()
  @IsIn(['openai', 'anthropic'])
  aiProvider?: 'openai' | 'anthropic';

  @IsOptional()
  @IsString()
  openaiApiKey?: string;

  @IsOptional()
  @IsString()
  anthropicApiKey?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  dailyTokenLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  tutorDailyTokenLimit?: number;
}
