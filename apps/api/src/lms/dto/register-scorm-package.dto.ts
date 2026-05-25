import { IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterScormPackageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  zipFileKey!: string;
}
