import { IsArray, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class VoteChoiceDto {
  @IsString()
  @MinLength(1)
  position!: string;

  @IsString()
  candidateId!: string;
}

export class CastVoteDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VoteChoiceDto)
  choices!: VoteChoiceDto[];
}
