import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsString, Min, ValidateNested } from 'class-validator';

class WorkloadSuggestionRowDto {
  @IsString()
  staffId!: string;

  @IsNumber()
  @Min(0)
  suggestedCreditHours!: number;
}

export class ApplyWorkloadSuggestionsDto {
  @IsString()
  semesterId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkloadSuggestionRowDto)
  suggestions!: WorkloadSuggestionRowDto[];
}
