import { IsOptional, IsString, MinLength } from 'class-validator';

export class NominateCandidateDto {
  @IsString()
  @MinLength(1)
  position!: string;

  @IsString()
  userId!: string;

  @IsOptional()
  @IsString()
  manifesto?: string;

  @IsOptional()
  @IsString()
  manifestoDocKey?: string;

  @IsOptional()
  @IsString()
  secondedBy?: string;
}
