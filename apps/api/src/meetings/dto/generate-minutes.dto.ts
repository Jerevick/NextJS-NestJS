import { IsString, MinLength } from 'class-validator';

export class GenerateMinutesDto {
  @IsString()
  @MinLength(20)
  transcript!: string;
}
