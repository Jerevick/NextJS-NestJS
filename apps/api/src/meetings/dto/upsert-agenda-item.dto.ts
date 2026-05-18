import { IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { AgendaItemType } from '@prisma/client';

export class UpsertAgendaItemDto {
  @IsString()
  @MinLength(1)
  itemNumber!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  presenterId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  duration?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsEnum(AgendaItemType)
  type?: AgendaItemType;
}
