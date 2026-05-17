import { FinanceGlAccountType, FinanceGlNormalBalance } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class UpsertFinanceGlAccountDto {
  @IsString()
  @MinLength(2)
  @Matches(/^[A-Za-z0-9-]+$/)
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsEnum(FinanceGlAccountType)
  type!: FinanceGlAccountType;

  @IsEnum(FinanceGlNormalBalance)
  normalBalance!: FinanceGlNormalBalance;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
