import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateDocumentTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  templateKey!: string;
}
