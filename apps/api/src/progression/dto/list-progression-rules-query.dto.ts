import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ProgressionRuleScope } from '@prisma/client';
import { CursorPageQueryDto } from '../../common/pagination/cursor-page-query.dto';

export class ListProgressionRulesQueryDto extends CursorPageQueryDto {
  @IsOptional()
  @IsEnum(ProgressionRuleScope)
  ruleScope?: ProgressionRuleScope;

  @IsOptional()
  @IsString()
  programId?: string;
}
