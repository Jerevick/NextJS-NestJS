import { IsString } from 'class-validator';

export class CarryForwardLeaveDto {
  @IsString()
  fromAcademicYearId!: string;

  @IsString()
  toAcademicYearId!: string;
}
