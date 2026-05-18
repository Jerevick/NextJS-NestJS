import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class StaffSalaryDto {
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  effectiveDate?: string;
}
