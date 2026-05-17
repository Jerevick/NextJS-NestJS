import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class RequestStudentExcessTransferDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  @MinLength(3)
  description!: string;

  @IsOptional()
  @IsString()
  targetStudentId?: string;

  @IsOptional()
  @IsString()
  targetStudentNumber?: string;

  @IsOptional()
  @IsString()
  currency?: string;
}
