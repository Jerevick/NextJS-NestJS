import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class PostStudentChargeDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string;

  @IsOptional()
  @IsIn(['CHARGE', 'ADJUSTMENT'])
  type?: 'CHARGE' | 'ADJUSTMENT';

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;
}
