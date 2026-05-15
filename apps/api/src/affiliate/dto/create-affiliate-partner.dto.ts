import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAffiliatePartnerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  label!: string;

  @IsOptional()
  @IsString()
  entityId?: string;
}
