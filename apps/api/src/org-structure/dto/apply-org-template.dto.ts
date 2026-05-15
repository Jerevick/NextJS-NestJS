import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ApplyOrgTemplateDto {
  @IsString()
  entityId!: string;

  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
