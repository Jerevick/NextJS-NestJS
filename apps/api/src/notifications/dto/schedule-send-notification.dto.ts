import { NotificationPriority } from '@prisma/client';
import { IsISO8601, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import type { NotificationChannel } from '../notification.types';

export class ScheduleSendNotificationDto {
  @IsString()
  recipientId!: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsString()
  @MinLength(1)
  event!: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @IsOptional()
  channels?: NotificationChannel[];

  @IsOptional()
  priority?: NotificationPriority;

  @IsOptional()
  @IsString()
  actionUrl?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsISO8601()
  scheduledAt!: string;
}
