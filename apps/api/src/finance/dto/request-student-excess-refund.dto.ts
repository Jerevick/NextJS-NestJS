import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class RequestStudentExcessRefundDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  @MinLength(3)
  description!: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  gatewayReference?: string;
}
