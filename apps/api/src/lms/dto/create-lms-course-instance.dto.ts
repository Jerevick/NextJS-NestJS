import { IsString, MinLength } from 'class-validator';

export class CreateLmsCourseInstanceDto {
  @IsString()
  @MinLength(1)
  sectionId!: string;
}
