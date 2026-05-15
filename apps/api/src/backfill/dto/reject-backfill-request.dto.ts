import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RejectBackfillRequestDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  comment?: string;
}
