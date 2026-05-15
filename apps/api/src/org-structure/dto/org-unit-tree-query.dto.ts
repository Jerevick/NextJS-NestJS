import { IsString } from 'class-validator';

export class OrgUnitTreeQueryDto {
  @IsString()
  entityId!: string;
}
