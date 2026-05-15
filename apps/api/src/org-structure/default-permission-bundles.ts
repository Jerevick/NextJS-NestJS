/** Default capability bundles seeded per institution (Phase 3). */
export const DEFAULT_PERMISSION_BUNDLES: Array<{
  code: string;
  name: string;
  description: string;
  permissions: string[];
}> = [
  {
    code: 'STUDENTS_FULL',
    name: 'Students — full',
    description: 'Full student registry read/write',
    permissions: ['students.read', 'students.write'],
  },
  {
    code: 'STUDENTS_VIEW',
    name: 'Students — view',
    description: 'Read-only student access',
    permissions: ['students.read'],
  },
  {
    code: 'STUDENTS_ADMIT',
    name: 'Students — admit',
    description: 'Admissions and new student intake',
    permissions: ['students.read', 'students.write', 'admissions.read', 'admissions.write'],
  },
  {
    code: 'STUDENTS_INACTIVATE',
    name: 'Students — inactivate',
    description: 'Initiate student inactivation workflows',
    permissions: ['students.read', 'students.write'],
  },
  {
    code: 'STUDENTS_REACTIVATE',
    name: 'Students — reactivate',
    description: 'Approve reactivation requests',
    permissions: ['students.read', 'students.reactivate'],
  },
  {
    code: 'STUDENTS_BACKFILL',
    name: 'Students — backfill',
    description: 'Submit backfill requests',
    permissions: ['students.read', 'backfill.request', 'backfill.read'],
  },
  {
    code: 'GRADES_ENTER',
    name: 'Grades — enter',
    description: 'Enter grades for assigned sections',
    permissions: ['grades.read', 'grades.enter'],
  },
  {
    code: 'GRADES_APPROVE',
    name: 'Grades — approve',
    description: 'Approve grade submissions',
    permissions: ['grades.read', 'grades.approve_board'],
  },
  {
    code: 'GRADES_OVERRIDE',
    name: 'Grades — override',
    description: 'Grade override workflow actions',
    permissions: ['grades.read', 'grades.write', 'grades.amend_approved'],
  },
  {
    code: 'ENROLLMENT_MANAGE',
    name: 'Enrollment — manage',
    description: 'Course registration management',
    permissions: ['enrollments.read', 'enrollments.write'],
  },
  {
    code: 'ENROLLMENT_VIEW',
    name: 'Enrollment — view',
    description: 'Read enrollments',
    permissions: ['enrollments.read'],
  },
  {
    code: 'FINANCE_FULL',
    name: 'Finance — full',
    description: 'Full finance module access',
    permissions: ['billing.read', 'billing.write'],
  },
  {
    code: 'FINANCE_VIEW',
    name: 'Finance — view',
    description: 'Read finance and billing',
    permissions: ['billing.read'],
  },
  {
    code: 'BILLING_VIEW',
    name: 'Billing — view',
    description: 'Institution SaaS billing visibility',
    permissions: ['billing.read'],
  },
  {
    code: 'BILLING_DISPUTE',
    name: 'Billing — dispute',
    description: 'Submit and resolve billing disputes',
    permissions: ['billing.read', 'billing.disputes.resolve'],
  },
  {
    code: 'CURRICULUM_MANAGE',
    name: 'Curriculum — manage',
    description: 'Academic structure and catalog',
    permissions: ['academic.read', 'academic.write'],
  },
  {
    code: 'COURSES_CREATE',
    name: 'Courses — create',
    description: 'Propose and manage courses',
    permissions: ['academic.read', 'academic.write', 'lms.write'],
  },
  {
    code: 'STAFF_MANAGE',
    name: 'Staff — manage',
    description: 'HR staff records',
    permissions: ['students.read'],
  },
  {
    code: 'STAFF_VIEW',
    name: 'Staff — view',
    description: 'Read staff directory',
    permissions: ['students.read'],
  },
  {
    code: 'REPORTS_INSTITUTION',
    name: 'Reports — institution',
    description: 'Consolidated institution reports',
    permissions: ['institutions.read', 'billing.read', 'students.read'],
  },
  {
    code: 'REPORTS_ENTITY',
    name: 'Reports — entity',
    description: 'Campus-level reports',
    permissions: ['institutions.read', 'students.read'],
  },
  {
    code: 'REPORTS_DEPARTMENT',
    name: 'Reports — department',
    description: 'Department-level reports',
    permissions: ['students.read', 'grades.read'],
  },
  {
    code: 'SYSTEM_CONFIG',
    name: 'System configuration',
    description: 'Institution and campus settings',
    permissions: ['institutions.read', 'institutions.write'],
  },
  {
    code: 'MODULES_MANAGE',
    name: 'Modules — manage',
    description: 'Enable/disable tenant modules',
    permissions: ['institutions.write'],
  },
  {
    code: 'ORG_MANAGE',
    name: 'Org structure — manage',
    description: 'Org units and positions',
    permissions: ['org.read', 'org.write'],
  },
  {
    code: 'ORG_VIEW',
    name: 'Org structure — view',
    description: 'Read org chart and positions',
    permissions: ['org.read'],
  },
];
