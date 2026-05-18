import { Injectable, Logger } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { LeaveRepository } from '../leave/leave.repository';

@Injectable()
export class StaffNotificationsService {
  private readonly log = new Logger(StaffNotificationsService.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly leaveRepo: LeaveRepository,
  ) {}

  async notifyLeaveDecision(
    institutionId: string,
    leaveRequestId: string,
    approved: boolean,
  ): Promise<void> {
    const req = await this.leaveRepo.findLeaveRequest(institutionId, leaveRequestId);
    if (!req?.staff?.user) return;
    const title = approved ? 'Leave request approved' : 'Leave request rejected';
    const body = approved
      ? `Your ${req.leaveType.name} leave (${req.durationDays} days) was approved.`
      : `Your ${req.leaveType.name} leave request was not approved.`;
    await this.notifications.create({
      institutionId,
      userId: req.staff.user.id,
      category: 'HR_LEAVE',
      title,
      body,
      actionUrl: '/staff',
      metadata: { leaveRequestId, approved },
    });
    const email = req.staff.user.email;
    if (email) {
      try {
        await this.mail.sendEmail(email, title, body, `<p>${body}</p>`);
      } catch (e) {
        this.log.warn(`Leave email failed for ${leaveRequestId}: ${String(e)}`);
      }
    }
  }
}
