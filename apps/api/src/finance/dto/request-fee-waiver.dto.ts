import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RequestFeeWaiverDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  currency?: string;
}
