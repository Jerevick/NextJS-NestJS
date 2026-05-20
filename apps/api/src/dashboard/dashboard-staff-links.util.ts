import type { AuthUser } from '../auth/auth.types';

export type StaffQuickLink = {
  href: string;
  label: string;
  description: string;
};

function can(actor: AuthUser, code: string): boolean {
  const p = actor.permissions ?? [];
  return p.includes('*') || p.includes(code);
}

/** Permission-aware shortcuts for STAFF / registrar / bursar-style roles. */
export function buildStaffQuickLinks(actor: AuthUser): StaffQuickLink[] {
  const links: StaffQuickLink[] = [];

  if (can(actor, 'students.read')) {
    links.push({
      href: '/students',
      label: 'Students',
      description: 'Search and manage student records',
    });
  }
  if (can(actor, 'admissions.read')) {
    links.push({
      href: '/admissions',
      label: 'Admissions',
      description: 'Application pipeline and cycles',
    });
  }
  if (can(actor, 'enrollments.read') || can(actor, 'enrollments.write')) {
    links.push({
      href: '/registrar/timetabling',
      label: 'Timetabling',
      description: 'Sections and scheduling',
    });
  }
  if (can(actor, 'grades.enter') || can(actor, 'grades.write')) {
    links.push({
      href: '/grades/entry',
      label: 'Grade entry',
      description: 'Release grades by section',
    });
  }
  if (can(actor, 'finance.read') || can(actor, 'finance.write')) {
    links.push({ href: '/finance', label: 'Finance', description: 'Fees, scholarships, and GL' });
  }
  if (
    can(actor, 'billing.read') ||
    can(actor, 'billing.write') ||
    can(actor, 'institutions.read')
  ) {
    links.push({ href: '/billing', label: 'Billing', description: 'SaaS billing and snapshots' });
  }
  if (can(actor, 'staff.read')) {
    links.push({
      href: '/staff',
      label: 'Staff & HR',
      description: 'Profiles, leave, and workload',
    });
  }
  if (can(actor, 'progression.write') || can(actor, 'students.write')) {
    links.push({
      href: '/registrar/progression',
      label: 'Progression',
      description: 'Batch promotion rules',
    });
  }
  if (can(actor, 'workflow.read') || can(actor, 'workflow.act')) {
    links.push({
      href: '/workflow/inbox',
      label: 'Workflow inbox',
      description: 'Pending approvals',
    });
  }
  links.push({
    href: '/notifications',
    label: 'Notifications',
    description: 'Messages and alerts',
  });

  return links;
}
