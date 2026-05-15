import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class FinalizeInvoiceDto {
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  reason?: string;
}
