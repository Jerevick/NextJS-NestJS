import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SuspendEntityDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason?: string;
}
