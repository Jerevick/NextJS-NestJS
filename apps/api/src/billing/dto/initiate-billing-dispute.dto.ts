import { ArrayMaxSize, IsArray, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class InitiateBillingDisputeDto {
  @IsString()
  @Length(5, 8000)
  reason!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  disputedStudentIds?: string[];
}
