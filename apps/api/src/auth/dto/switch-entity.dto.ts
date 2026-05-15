import { IsString, MinLength } from 'class-validator';

export class SwitchEntityDto {
  @IsString()
  @MinLength(1)
  entityId!: string;
}
