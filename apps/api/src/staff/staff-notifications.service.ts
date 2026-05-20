import { Injectable, Logger } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { LeaveRepository } from '../leave/leave.repository';

@Injectable()
export class StaffNotificationsService {
  private readonly log = new Logger(StaffNotificationsService.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly leaveRepo: LeaveRepository,
  ) {}

  async notifyLeaveDecision(
    institutionId: string,
    leaveRequestId: string,
    approved: boolean,
  ): Promise<void> {
    const req = await this.leaveRepo.findLeaveRequest(institutionId, leaveRequestId);
    if (!req?.staff?.user) return;

    const decision = approved ? 'approved' : 'rejected';
    const body = approved
      ? `Your ${req.leaveType.name} leave (${req.durationDays} days) was approved.`
      : `Your ${req.leaveType.name} leave request was not approved.`;

    await this.notifications.sendSystem({
      institutionId,
      entityId: req.entityId,
      recipientId: req.staff.user.id,
      event: 'LEAVE_DECISION',
      data: { decision, body },
      actionUrl: '/staff',
      channels: ['inApp', 'email'],
    });
  }
}
