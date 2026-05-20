import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { CursorPageQueryDto } from '../../common/pagination/cursor-page-query.dto';

export class ListNotificationsQueryDto extends CursorPageQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  unreadOnly?: boolean;
}
