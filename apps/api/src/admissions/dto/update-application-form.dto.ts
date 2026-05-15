import { IsObject } from 'class-validator';

export class UpdateApplicationFormDto {
  @IsObject()
  schema!: Record<string, unknown>;
}
