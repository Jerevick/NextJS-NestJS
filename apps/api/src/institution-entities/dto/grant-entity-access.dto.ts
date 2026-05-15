import { IsString, MinLength } from 'class-validator';

export class GrantEntityAccessDto {
  @IsString()
  @MinLength(1)
  userId!: string;
}
