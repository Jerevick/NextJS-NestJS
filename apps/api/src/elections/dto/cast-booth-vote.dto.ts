import { IsArray, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CastVoteDto } from './cast-vote.dto';

export class CastBoothVoteDto extends CastVoteDto {
  @IsString()
  @MinLength(32)
  ballotToken!: string;

  @IsString()
  @MinLength(32)
  ballotSignature!: string;

  @IsString()
  @MinLength(64)
  blindRsaSignature!: string;
}
