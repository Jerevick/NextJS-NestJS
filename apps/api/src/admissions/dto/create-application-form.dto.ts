import { IsObject } from 'class-validator';

export class CreateApplicationFormDto {
  @IsObject()
  schema!: Record<string, unknown>;
}
