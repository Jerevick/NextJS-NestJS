import { IsObject, IsOptional } from 'class-validator';

export class SaveQuizDraftDto {
  @IsOptional()
  @IsObject()
  answers?: Record<string, unknown>;
}
