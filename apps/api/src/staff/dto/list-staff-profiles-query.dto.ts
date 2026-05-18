import { IsIn, IsOptional, IsString } from 'class-validator';

export class ListStaffProfilesQueryDto {
  /** `entity` (default) scopes to X-Entity-ID; `institution` lists all campuses. */
  @IsOptional()
  @IsIn(['entity', 'institution'])
  scope?: 'entity' | 'institution';

  @IsOptional()
  @IsString()
  entityId?: string;
}
