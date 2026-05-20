import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { InstitutionEntitiesService } from '../institution-entities/institution-entities.service';
import { buildStaffQuickLinks } from './dashboard-staff-links.util';
import { DashboardRepository } from './dashboard.repository';

function displayName(profile: unknown, email: string): string {
  if (profile && typeof profile === 'object') {
    const p = profile as Record<string, unknown>;
    const first = typeof p.firstName === 'string' ? p.firstName : '';
    const last = typeof p.lastName === 'string' ? p.lastName : '';
    const name = [first, last].filter(Boolean).join(' ').trim();
    if (name) {
      return name;
    }
  }
  return email;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly repo: DashboardRepository,
    private readonly entities: InstitutionEntitiesService,
  ) {}

  async getFacultyHome(actor: AuthUser) {
    const scopeEntityId = actor.entityScope === 'ALL' ? undefined : actor.entityId;
    const sections = await this.repo.findInstructorSections(
      actor.institutionId,
      actor.userId,
      scopeEntityId,
    );

    const [workflowCount, workflowPreview, userBrief] = await Promise.all([
      this.repo.countWorkflowInbox(actor.institutionId, actor.userId),
      this.repo.workflowInboxPreview(actor.institutionId, actor.userId, 5),
      this.repo.findUserBrief(actor.userId),
    ]);

    const courses = sections.map((s) => ({
      sectionId: s.id,
      courseCode: s.course.code,
      courseTitle: s.course.title,
      semesterName: s.semester.name,
      enrolledCount: s._count.enrollments,
      maxEnrollment: s.maxEnrollment,
      room: s.room,
      lmsCourseInstanceId: s.lmsCourseInstance?.id ?? null,
      lmsPublished: s.lmsCourseInstance?.isPublished ?? false,
    }));

    return {
      displayName: displayName(userBrief?.profile, actor.email),
      teaching: {
        sectionCount: sections.length,
        courses,
      },
      workflow: {
        pendingCount: workflowCount,
        preview: workflowPreview.map((w) => ({
          id: w.id,
          definitionCode: w.definitionCode,
          definitionName: w.definition.name,
          currentStepName: w.currentStepName,
          dueAt: w.dueAt.toISOString(),
          entityCode: w.entity.code,
        })),
      },
    };
  }

  async getStaffHome(actor: AuthUser) {
    const scopeEntityId = actor.entityScope === 'ALL' ? undefined : actor.entityId;
    const canWorkflow =
      actor.permissions.includes('*') ||
      actor.permissions.includes('workflow.read') ||
      actor.permissions.includes('workflow.act');
    const canStudents =
      actor.permissions.includes('*') || actor.permissions.includes('students.read');
    const canAdmissions =
      actor.permissions.includes('*') || actor.permissions.includes('admissions.read');

    const [workflowCount, workflowPreview, studentCount, pendingApplications, entity] =
      await Promise.all([
        canWorkflow
          ? this.repo.countWorkflowInbox(actor.institutionId, actor.userId)
          : Promise.resolve(0),
        canWorkflow
          ? this.repo.workflowInboxPreview(actor.institutionId, actor.userId, 5)
          : Promise.resolve([]),
        canStudents
          ? this.repo.countStudents(actor.institutionId, scopeEntityId)
          : Promise.resolve(null),
        canAdmissions
          ? this.repo.countPendingApplications(actor.institutionId)
          : Promise.resolve(null),
        scopeEntityId
          ? this.repo.findEntityBrief(actor.institutionId, scopeEntityId)
          : Promise.resolve(null),
      ]);

    return {
      role: actor.role,
      entityScope: actor.entityScope,
      entity: entity ? { code: entity.code, name: entity.name, status: entity.status } : null,
      metrics: {
        workflowPending: canWorkflow ? workflowCount : null,
        activeStudents: studentCount,
        pendingApplications,
      },
      workflowPreview: workflowPreview.map((w) => ({
        id: w.id,
        definitionCode: w.definitionCode,
        definitionName: w.definition.name,
        currentStepName: w.currentStepName,
        dueAt: w.dueAt.toISOString(),
        entityCode: w.entity.code,
      })),
      quickLinks: buildStaffQuickLinks(actor),
    };
  }

  async getAdminHome(actor: AuthUser) {
    const scopeEntityId = actor.entityScope === 'ALL' ? undefined : actor.entityId;
    const canConsolidated =
      actor.entityScope === 'ALL' &&
      (actor.permissions.includes('*') || actor.permissions.includes('institutions.read'));

    const [workflowCount, workflowPreview, consolidated, entityStats, entity] = await Promise.all([
      this.repo.countWorkflowInbox(actor.institutionId, actor.userId),
      this.repo.workflowInboxPreview(actor.institutionId, actor.userId, 5),
      canConsolidated
        ? this.entities.consolidatedStats(actor, actor.institutionId).catch(() => null)
        : Promise.resolve(null),
      scopeEntityId
        ? this.entities.getEntityStats(actor.institutionId, scopeEntityId).catch(() => null)
        : Promise.resolve(null),
      scopeEntityId
        ? this.repo.findEntityBrief(actor.institutionId, scopeEntityId)
        : Promise.resolve(null),
    ]);

    let institutionTotals: {
      billableStudentCount: number;
      inactiveStudentCount: number;
      totalStudentCount: number;
    } | null = null;
    let campuses: Array<{ entityId: string; code: string; name: string; activeStudents: number }> =
      [];

    if (consolidated) {
      institutionTotals = {
        billableStudentCount: consolidated.institutionTotals.billableStudentCount,
        inactiveStudentCount: consolidated.institutionTotals.inactiveStudentCount,
        totalStudentCount: consolidated.institutionTotals.totalStudentCount,
      };
      campuses = consolidated.entities.map((e) => ({
        entityId: e.entityId,
        code: e.code,
        name: e.name,
        activeStudents: e.billableStudentCount,
      }));
    }

    return {
      entityScope: actor.entityScope,
      entity: entity ? { code: entity.code, name: entity.name, status: entity.status } : null,
      institutionTotals,
      entityStats: entityStats
        ? {
            activeStudents: entityStats.activeStudents,
            totalStudents: entityStats.totalStudents,
            staffCount: entityStats.staffCount,
            enrollmentsCurrentAcademicYear: entityStats.enrollmentsCurrentAcademicYear,
          }
        : null,
      campuses,
      workflow: {
        pendingCount: workflowCount,
        preview: workflowPreview.map((w) => ({
          id: w.id,
          definitionCode: w.definitionCode,
          definitionName: w.definition.name,
          dueAt: w.dueAt.toISOString(),
          entityCode: w.entity.code,
        })),
      },
    };
  }

  async getAlumniHome(actor: AuthUser) {
    const profile = await this.repo.findAlumniProfileByUserId(actor.institutionId, actor.userId);

    const user = await this.repo.findUserBrief(actor.userId);

    if (!profile) {
      return {
        hasProfile: false,
        displayName: displayName(user?.profile, actor.email),
        profile: null,
        upcomingEvents: [],
        openJobsCount: 0,
      };
    }

    const [events, openJobsCount] = await Promise.all([
      this.repo.listUpcomingAlumniEvents(actor.institutionId, profile.entityId, 6),
      this.repo.countOpenJobs(actor.institutionId),
    ]);

    return {
      hasProfile: true,
      displayName: displayName(user?.profile, actor.email),
      profile: {
        id: profile.id,
        graduationYear: profile.graduationYear,
        currentEmployer: profile.currentEmployer,
        jobTitle: profile.jobTitle,
        mentorshipAvailable: profile.mentorshipAvailable,
        programme: profile.programme,
        entity: profile.entity,
        isVerified: profile.isVerified,
      },
      upcomingEvents: events.map((e) => ({
        id: e.id,
        title: e.title,
        startAt: e.startDate.toISOString(),
        endAt: e.endDate?.toISOString() ?? null,
        location: e.location,
        isVirtual: e.isVirtual,
      })),
      openJobsCount,
    };
  }
}
