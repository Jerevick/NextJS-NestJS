import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from 'class-validator';

export class ImportBankItemsToAssessmentDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  bankItemIds!: string[];
}
