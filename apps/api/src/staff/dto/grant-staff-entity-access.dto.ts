import { IsString } from 'class-validator';

export class GrantStaffEntityAccessDto {
  @IsString()
  entityId!: string;
}
