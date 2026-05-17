import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateBulkChargeDto {
  @IsUUID()
  programId!: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @Type(() => Number)
  @Min(0.01)
  amount!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string;
}
