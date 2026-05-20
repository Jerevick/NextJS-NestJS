import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { AttendanceService } from '../attendance/attendance.service';
import { PrismaService } from '../prisma/prisma.service';
import type { BulkMarkAttendanceDto } from '../attendance/dto/bulk-mark-attendance.dto';

@Injectable()
export class MobileSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendance: AttendanceService,
  ) {}

  async attendanceChangesSince(
    actor: AuthUser,
    since: string,
    entityId?: string,
  ): Promise<{ records: unknown[]; syncedAt: string }> {
    const sinceDate = new Date(since);
    if (Number.isNaN(sinceDate.getTime())) {
      throw new BadRequestException('Invalid since timestamp');
    }
    const scopedEntity =
      entityId?.trim() || (actor.entityScope === 'ENTITY' ? actor.entityId : undefined);
    const rows = await this.prisma.attendance.findMany({
      where: {
        institutionId: actor.institutionId,
        updatedAt: { gte: sinceDate },
        deletedAt: null,
        ...(scopedEntity ? { section: { entityId: scopedEntity } } : {}),
      },
      orderBy: { updatedAt: 'asc' },
      take: 500,
      select: {
        id: true,
        studentId: true,
        sectionId: true,
        sessionDate: true,
        status: true,
        notes: true,
        updatedAt: true,
      },
    });
    return { records: rows, syncedAt: new Date().toISOString() };
  }

  async bulkUploadAttendance(actor: AuthUser, dto: BulkMarkAttendanceDto) {
    if (
      !actor.permissions.includes('*') &&
      !actor.permissions.includes('attendance.write') &&
      !actor.permissions.includes('attendance.enter')
    ) {
      throw new ForbiddenException('Missing attendance.write permission');
    }
    return this.attendance.markBulk(actor, dto);
  }
}
