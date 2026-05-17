import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ProgressionRuleScope } from '@prisma/client';

export class ListProgressionRulesQueryDto {
  @IsOptional()
  @IsEnum(ProgressionRuleScope)
  ruleScope?: ProgressionRuleScope;

  @IsOptional()
  @IsString()
  programId?: string;
}
