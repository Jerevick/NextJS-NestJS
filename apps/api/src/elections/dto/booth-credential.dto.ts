import { IsString, MinLength } from 'class-validator';

export class BoothCredentialDto {
  @IsString()
  @MinLength(32)
  ballotToken!: string;

  @IsString()
  @MinLength(32)
  ballotSignature!: string;
}
