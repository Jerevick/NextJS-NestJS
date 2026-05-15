import { ForbiddenException } from '@nestjs/common';
import type { OrgUnit } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';

export type OrgUnitTreeNode = {
  id: string;
  code: string;
  name: string;
  type: string;
  parentId: string | null;
  isActive: boolean;
  sortOrder: number;
  children: OrgUnitTreeNode[];
};

export function assertInstitutionAccess(actor: AuthUser, institutionId: string): void {
  if (actor.permissions.includes('*')) {
    return;
  }
  if (actor.institutionId === institutionId) {
    return;
  }
  throw new ForbiddenException('You may only access your own institution');
}

export function assertOrgRead(actor: AuthUser): void {
  if (
    actor.permissions.includes('*') ||
    actor.permissions.includes('org.read') ||
    actor.permissions.includes('institutions.write')
  ) {
    return;
  }
  throw new ForbiddenException('Missing org.read permission');
}

export function assertOrgWrite(actor: AuthUser): void {
  if (actor.permissions.includes('*') || actor.permissions.includes('org.write')) {
    return;
  }
  if (actor.permissions.includes('institutions.write')) {
    return;
  }
  throw new ForbiddenException('Missing org.write permission');
}

export function assertEntityAccess(actor: AuthUser, entityId: string): void {
  if (actor.entityScope === 'ALL') {
    return;
  }
  if (actor.entityId !== entityId) {
    throw new ForbiddenException('This campus is outside your entity scope');
  }
}

export function buildOrgUnitTree(rows: OrgUnit[]): OrgUnitTreeNode[] {
  const byId = new Map<string, OrgUnitTreeNode>();
  for (const r of rows) {
    byId.set(r.id, {
      id: r.id,
      code: r.code,
      name: r.name,
      type: r.type,
      parentId: r.parentId,
      isActive: r.isActive,
      sortOrder: r.sortOrder,
      children: [],
    });
  }
  const roots: OrgUnitTreeNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortNodes = (nodes: OrgUnitTreeNode[]): void => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
    for (const n of nodes) {
      sortNodes(n.children);
    }
  };
  sortNodes(roots);
  return roots;
}
