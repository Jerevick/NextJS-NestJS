import { CustomFormStatus, CustomFormType } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCustomFormDto {
  @IsEnum(CustomFormType)
  formType!: CustomFormType;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsObject()
  schema!: Record<string, unknown>;
}

export class UpdateCustomFormDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsObject()
  schema?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(CustomFormStatus)
  status?: CustomFormStatus;
}

export class SubmitCustomFormDto {
  @IsObject()
  data!: Record<string, unknown>;
}
