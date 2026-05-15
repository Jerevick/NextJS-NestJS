import { IsEmail, IsString, MinLength } from 'class-validator';

export class MagicLinkRequestDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  institutionSlug!: string;
}
