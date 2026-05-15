import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ReviewReactivationRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  reviewNotes?: string;
}
