import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class EstimateBackfillFeeQueryDto {
  @IsString()
  @IsNotEmpty()
  studentId!: string;

  @IsDateString()
  fromDate!: string;

  @IsDateString()
  toDate!: string;
}
