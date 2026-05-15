import { IsOptional, IsString } from 'class-validator';

export class ListPositionsQueryDto {
  @IsString()
  entityId!: string;

  @IsOptional()
  @IsString()
  vacantOnly?: string;
}
