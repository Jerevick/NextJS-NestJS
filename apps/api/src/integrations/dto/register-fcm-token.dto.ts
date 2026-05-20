import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RegisterFcmTokenDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  token!: string;
}
