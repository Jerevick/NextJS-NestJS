import { IsIn, IsOptional, IsString } from 'class-validator';
import { CursorPageQueryDto } from '../../common/pagination/cursor-page-query.dto';

export class ListStaffProfilesQueryDto extends CursorPageQueryDto {
  /** `entity` (default) scopes to X-Entity-ID; `institution` lists all campuses. */
  @IsOptional()
  @IsIn(['entity', 'institution'])
  scope?: 'entity' | 'institution';

  @IsOptional()
  @IsString()
  entityId?: string;
}
