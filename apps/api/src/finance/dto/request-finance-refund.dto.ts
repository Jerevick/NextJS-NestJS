import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RequestFinanceRefundDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  currency?: string;

  /** Original gateway payment reference when refunding an online payment. */
  @IsOptional()
  @IsString()
  gatewayReference?: string;
}
