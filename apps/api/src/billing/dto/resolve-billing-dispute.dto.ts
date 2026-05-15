import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ResolveBillingDisputeDto {
  @IsIn(['ACCEPT', 'REJECT'])
  resolution!: 'ACCEPT' | 'REJECT';

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  notes?: string;
}
