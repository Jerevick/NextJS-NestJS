import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class PaymentPlanInstallmentDto {
  @IsDateString()
  dueDate!: string;

  @Type(() => Number)
  @Min(0.01)
  amount!: number;
}

export class CreatePaymentPlanDto {
  @Type(() => Number)
  @Min(0.01)
  totalAmount!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PaymentPlanInstallmentDto)
  installments!: PaymentPlanInstallmentDto[];
}
