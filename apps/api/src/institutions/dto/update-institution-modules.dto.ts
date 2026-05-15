import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsEnum, ValidateNested } from 'class-validator';
import { TenantModule } from '@prisma/client';

export class InstitutionModuleToggleDto {
  @IsEnum(TenantModule)
  module!: TenantModule;

  @IsBoolean()
  enabled!: boolean;
}

export class UpdateInstitutionModulesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InstitutionModuleToggleDto)
  modules!: InstitutionModuleToggleDto[];
}
