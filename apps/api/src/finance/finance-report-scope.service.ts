import { ForbiddenException, Injectable } from '@nestjs/common';
import { OrgUnitType } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

export type FinanceReportFilters = {
  entityId?: string;
  programmeId?: string;
  departmentId?: string;
  departmentIds?: string[];
  /** When true, report queries should return no rows. */
  empty: boolean;
};

@Injectable()
export class FinanceReportScopeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Finance Director (BURSAR / institution-wide finance.read): full scope.
   * Dean: faculty org-unit subtree + academic divisions where deanId matches.
   * HoD: headed departments + department org-units (settings.departmentId or code).
   */
  async resolve(
    actor: AuthUser,
    query?: { programmeId?: string; departmentId?: string },
  ): Promise<FinanceReportFilters> {
    const entityId = actor.entityScope === 'ENTITY' ? actor.entityId : undefined;

    const [headedDepts, deanDivisions, positionHolders, positionDeptIds, facultySubtreeDeptIds] =
      await Promise.all([
        this.prisma.department.findMany({
          where: {
            institutionId: actor.institutionId,
            headId: actor.userId,
            deletedAt: null,
          },
          select: { id: true },
        }),
        this.prisma.academicDivision.findMany({
          where: {
            institutionId: actor.institutionId,
            deanId: actor.userId,
            deletedAt: null,
          },
          select: { id: true },
        }),
        this.prisma.positionHolder.findMany({
          where: {
            institutionId: actor.institutionId,
            userId: actor.userId,
            endDate: null,
            ...(entityId ? { entityId } : {}),
          },
          include: {
            position: { select: { code: true, orgUnitId: true, scope: true } },
          },
        }),
        this.departmentIdsFromPositionOrgUnits(actor.institutionId, actor.userId, entityId),
        this.departmentIdsFromFacultyOrgUnitSubtree(actor.institutionId, actor.userId, entityId),
      ]);

    const positionCodes = new Set(positionHolders.map((h) => h.position.code));
    const isBursar = positionCodes.has('BURSAR');
    const hasFinanceAll = actor.entityScope === 'ALL' && actor.permissions.includes('finance.read');

    let scopedDepartmentIds: string[] | undefined;

    if (isBursar || (hasFinanceAll && !positionCodes.has('DEAN') && !positionCodes.has('HOD'))) {
      scopedDepartmentIds = undefined;
    } else {
      const deptIds = new Set<string>([
        ...headedDepts.map((d) => d.id),
        ...positionDeptIds,
        ...facultySubtreeDeptIds,
      ]);
      if (deanDivisions.length > 0) {
        const divisionDepts = await this.prisma.department.findMany({
          where: {
            institutionId: actor.institutionId,
            divisionId: { in: deanDivisions.map((d) => d.id) },
            deletedAt: null,
          },
          select: { id: true },
        });
        for (const d of divisionDepts) {
          deptIds.add(d.id);
        }
      }
      if (deptIds.size > 0) {
        scopedDepartmentIds = [...deptIds];
      } else if (positionCodes.has('DEAN') || positionCodes.has('HOD')) {
        scopedDepartmentIds = [];
      }
    }

    let departmentIds = scopedDepartmentIds;
    if (query?.departmentId?.trim()) {
      const requested = query.departmentId.trim();
      if (departmentIds && !departmentIds.includes(requested)) {
        throw new ForbiddenException('Department is outside your finance report scope');
      }
      departmentIds = [requested];
    }

    if (departmentIds && departmentIds.length === 0) {
      return { entityId, programmeId: query?.programmeId, departmentIds: [], empty: true };
    }

    return {
      entityId,
      programmeId: query?.programmeId,
      departmentId: query?.departmentId,
      departmentIds,
      empty: false,
    };
  }

  /**
   * DEAN (and FACULTY-scoped holders) on FACULTY org units → all descendant DEPARTMENT org units
   * mapped to academic Department rows.
   */
  private async departmentIdsFromFacultyOrgUnitSubtree(
    institutionId: string,
    userId: string,
    entityId?: string,
  ): Promise<string[]> {
    const holders = await this.prisma.positionHolder.findMany({
      where: {
        institutionId,
        userId,
        endDate: null,
        ...(entityId ? { entityId } : {}),
        position: {
          code: { in: ['DEAN', 'ASSOC_DEAN', 'FACULTY_DEAN'] },
          deletedAt: null,
        },
      },
      include: {
        position: {
          select: { orgUnitId: true, scope: true },
        },
      },
    });

    const facultyRootIds = new Set<string>();
    for (const h of holders) {
      const ou = await this.prisma.orgUnit.findFirst({
        where: { id: h.position.orgUnitId, deletedAt: null },
        select: { id: true, type: true },
      });
      if (!ou) {
        continue;
      }
      if (ou.type === OrgUnitType.FACULTY || h.position.scope === 'FACULTY') {
        facultyRootIds.add(ou.id);
      }
    }

    if (facultyRootIds.size === 0) {
      return [];
    }

    const departmentOrgUnitIds = await this.collectDescendantOrgUnitIds(
      institutionId,
      [...facultyRootIds],
      [OrgUnitType.DEPARTMENT],
    );

    return this.academicDepartmentIdsFromOrgUnits(institutionId, departmentOrgUnitIds);
  }

  private async collectDescendantOrgUnitIds(
    institutionId: string,
    rootIds: string[],
    targetTypes: OrgUnitType[],
  ): Promise<string[]> {
    const found = new Set<string>();
    const queue = [...rootIds];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) {
        continue;
      }
      visited.add(id);

      const unit = await this.prisma.orgUnit.findFirst({
        where: { id, institutionId, deletedAt: null },
        select: { id: true, type: true },
      });
      if (!unit) {
        continue;
      }
      if (targetTypes.includes(unit.type)) {
        found.add(unit.id);
      }

      const children = await this.prisma.orgUnit.findMany({
        where: { parentId: id, institutionId, deletedAt: null },
        select: { id: true },
      });
      for (const child of children) {
        queue.push(child.id);
      }
    }

    return [...found];
  }

  private async academicDepartmentIdsFromOrgUnits(
    institutionId: string,
    orgUnitIds: string[],
  ): Promise<string[]> {
    if (orgUnitIds.length === 0) {
      return [];
    }
    const units = await this.prisma.orgUnit.findMany({
      where: { id: { in: orgUnitIds }, institutionId, deletedAt: null },
      select: { id: true, code: true, settings: true },
    });
    const deptIds = new Set<string>();
    for (const ou of units) {
      const settings =
        ou.settings && typeof ou.settings === 'object' && !Array.isArray(ou.settings)
          ? (ou.settings as Record<string, unknown>)
          : {};
      if (typeof settings.departmentId === 'string') {
        deptIds.add(settings.departmentId);
        continue;
      }
      if (typeof settings.academicDepartmentId === 'string') {
        deptIds.add(settings.academicDepartmentId);
        continue;
      }
      const dept = await this.prisma.department.findFirst({
        where: { institutionId, code: ou.code, deletedAt: null },
        select: { id: true },
      });
      if (dept) {
        deptIds.add(dept.id);
      }
    }
    return [...deptIds];
  }

  /** Map DEAN/HOD position holders to departments via org unit settings or department code. */
  private async departmentIdsFromPositionOrgUnits(
    institutionId: string,
    userId: string,
    entityId?: string,
  ): Promise<string[]> {
    const holders = await this.prisma.positionHolder.findMany({
      where: {
        institutionId,
        userId,
        endDate: null,
        ...(entityId ? { entityId } : {}),
        position: { code: { in: ['DEAN', 'HOD', 'ASSOC_DEAN', 'FACULTY_DEAN'] }, deletedAt: null },
      },
      include: {
        position: { select: { code: true, orgUnitId: true, scope: true } },
      },
    });
    const deptIds = new Set<string>();
    for (const h of holders) {
      const orgUnit = await this.prisma.orgUnit.findFirst({
        where: { id: h.position.orgUnitId, deletedAt: null },
        select: { code: true, settings: true, type: true },
      });
      if (!orgUnit) {
        continue;
      }
      if (orgUnit.type === OrgUnitType.DEPARTMENT || h.position.code === 'HOD') {
        const mapped = await this.academicDepartmentIdsFromOrgUnits(institutionId, [
          h.position.orgUnitId,
        ]);
        for (const id of mapped) {
          deptIds.add(id);
        }
      }
      const settings =
        orgUnit.settings && typeof orgUnit.settings === 'object' && !Array.isArray(orgUnit.settings)
          ? (orgUnit.settings as Record<string, unknown>)
          : {};
      if (typeof settings.departmentId === 'string') {
        deptIds.add(settings.departmentId);
        continue;
      }
      const dept = await this.prisma.department.findFirst({
        where: { institutionId, code: orgUnit.code, deletedAt: null },
        select: { id: true },
      });
      if (dept) {
        deptIds.add(dept.id);
      }
    }
    return [...deptIds];
  }
}
