import { IsString, MinLength } from 'class-validator';

export class BlindSignDto {
  @IsString()
  @MinLength(32)
  ballotToken!: string;

  @IsString()
  @MinLength(64)
  blindedCommitmentHex!: string;
}
