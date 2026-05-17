import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateBulkEnrollmentDto {
  @IsString()
  sectionId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsString({ each: true })
  studentIds!: string[];

  @IsOptional()
  @IsBoolean()
  waitlistIfFull?: boolean;

  @IsOptional()
  @IsBoolean()
  allowInterEntity?: boolean;
}
