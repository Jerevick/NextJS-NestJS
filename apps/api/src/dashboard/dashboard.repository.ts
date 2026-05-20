import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  findInstructorSections(institutionId: string, instructorId: string, scopeEntityId?: string) {
    return this.prisma.section.findMany({
      where: {
        institutionId,
        deletedAt: null,
        instructorId,
        ...(scopeEntityId ? { entityId: scopeEntityId } : {}),
      },
      orderBy: { semester: { startDate: 'desc' } },
      take: 24,
      select: {
        id: true,
        room: true,
        maxEnrollment: true,
        semester: { select: { id: true, name: true } },
        course: { select: { id: true, code: true, title: true, creditHours: true } },
        _count: { select: { enrollments: true } },
        lmsCourseInstance: { select: { id: true, isPublished: true } },
      },
    });
  }

  countWorkflowInbox(institutionId: string, userId: string) {
    return this.prisma.workflowInstance.count({
      where: {
        institutionId,
        currentAssigneeUserId: userId,
        status: { in: ['IN_PROGRESS', 'ESCALATED'] },
      },
    });
  }

  workflowInboxPreview(institutionId: string, userId: string, take = 5) {
    return this.prisma.workflowInstance.findMany({
      where: {
        institutionId,
        currentAssigneeUserId: userId,
        status: { in: ['IN_PROGRESS', 'ESCALATED'] },
      },
      orderBy: { dueAt: 'asc' },
      take,
      select: {
        id: true,
        definitionCode: true,
        currentStepName: true,
        dueAt: true,
        definition: { select: { name: true } },
        entity: { select: { code: true } },
      },
    });
  }

  countStudents(institutionId: string, entityId?: string) {
    return this.prisma.student.count({
      where: {
        institutionId,
        deletedAt: null,
        enrollmentStatus: 'ACTIVE',
        ...(entityId ? { entityId } : {}),
      },
    });
  }

  countPendingApplications(institutionId: string) {
    return this.prisma.application.count({
      where: {
        institutionId,
        deletedAt: null,
        status: { in: ['PENDING', 'UNDER_REVIEW'] },
      },
    });
  }

  findUserBrief(userId: string) {
    return this.prisma.user.findFirst({
      where: { id: userId },
      select: { email: true, profile: true },
    });
  }

  findAlumniProfileByUserId(institutionId: string, userId: string) {
    return this.prisma.alumniProfile.findFirst({
      where: { institutionId, userId, deletedAt: null },
      include: {
        programme: { select: { code: true, name: true } },
        entity: { select: { code: true, name: true } },
      },
    });
  }

  listUpcomingAlumniEvents(institutionId: string, entityId: string, take = 6) {
    const now = new Date();
    return this.prisma.alumniEvent.findMany({
      where: {
        institutionId,
        entityId,
        deletedAt: null,
        startDate: { gte: now },
      },
      orderBy: { startDate: 'asc' },
      take,
      select: {
        id: true,
        title: true,
        startDate: true,
        endDate: true,
        location: true,
        isVirtual: true,
      },
    });
  }

  countOpenJobs(institutionId: string) {
    return this.prisma.jobPosting.count({
      where: { institutionId, isActive: true },
    });
  }

  findEntityBrief(institutionId: string, entityId: string) {
    return this.prisma.institutionEntity.findFirst({
      where: { institutionId, id: entityId, deletedAt: null },
      select: { id: true, code: true, name: true, status: true },
    });
  }
}
