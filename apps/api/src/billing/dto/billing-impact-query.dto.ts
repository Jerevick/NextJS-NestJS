import { IsDateString, IsOptional } from 'class-validator';

export class BillingImpactQueryDto {
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}
