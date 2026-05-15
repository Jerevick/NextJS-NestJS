import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateReactivationRequestDto {
  @IsString()
  @IsNotEmpty()
  studentId!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(8000)
  justification!: string;
}
