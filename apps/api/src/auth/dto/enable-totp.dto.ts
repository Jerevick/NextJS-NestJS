import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class EnableTotpDto {
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  secret!: string;

  @IsString()
  @Matches(/^[0-9]{6}$/)
  token!: string;
}
