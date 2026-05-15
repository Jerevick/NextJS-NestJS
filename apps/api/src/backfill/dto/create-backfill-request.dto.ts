import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateBackfillRequestDto {
  @IsString()
  @IsNotEmpty()
  studentId!: string;

  @IsDateString()
  fromDate!: string;

  @IsDateString()
  toDate!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(8000)
  justification!: string;

  @Type(() => Boolean)
  @IsBoolean()
  billingAcknowledged!: boolean;
}
