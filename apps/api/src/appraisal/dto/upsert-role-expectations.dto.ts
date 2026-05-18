import { IsArray, IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class UpsertRoleExpectationsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  positionCode?: string;

  @IsOptional()
  @IsInt()
  positionLevel?: number;

  @IsArray()
  @IsString({ each: true })
  duties!: string[];

  @IsArray()
  @IsString({ each: true })
  responsibilities!: string[];
}
