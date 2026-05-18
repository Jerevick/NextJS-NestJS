import { IsOptional, IsString, Length, Matches } from 'class-validator';

/** Optional client-generated commitment (SHA-256 hex) for true client-side blinding. */
export class IssueBoothDto {
  @IsOptional()
  @IsString()
  @Length(64, 64)
  @Matches(/^[a-f0-9]+$/i)
  ballotCommitment?: string;
}
