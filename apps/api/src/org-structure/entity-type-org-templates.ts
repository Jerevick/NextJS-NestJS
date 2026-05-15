import type { InstitutionEntityType, OrgUnitType, PositionScope } from '@prisma/client';

export type OrgTemplateUnit = {
  code: string;
  name: string;
  type: OrgUnitType;
  sortOrder: number;
  children?: OrgTemplateUnit[];
};

export type OrgTemplatePosition = {
  orgUnitCode: string;
  code: string;
  title: string;
  level: number;
  scope: PositionScope;
  permissionBundles: string[];
  isUnique?: boolean;
};

export type EntityOrgTemplate = {
  units: OrgTemplateUnit[];
  positions: OrgTemplatePosition[];
};

const MAIN_CAMPUS_TEMPLATE: EntityOrgTemplate = {
  units: [
    { code: 'REG', name: 'Registry', type: 'ADMIN_UNIT', sortOrder: 1 },
    { code: 'FIN', name: 'Finance Office', type: 'ADMIN_UNIT', sortOrder: 2 },
    {
      code: 'ENG',
      name: 'Faculty of Engineering',
      type: 'FACULTY',
      sortOrder: 3,
      children: [
        {
          code: 'CSE',
          name: 'Department of Computer Science',
          type: 'DEPARTMENT',
          sortOrder: 1,
          children: [
            {
              code: 'BSCS',
              name: 'B.Sc. Computer Science',
              type: 'PROGRAMME',
              sortOrder: 1,
            },
          ],
        },
      ],
    },
  ],
  positions: [
    {
      orgUnitCode: 'REG',
      code: 'VC',
      title: 'Vice-Chancellor',
      level: 1,
      scope: 'INSTITUTION',
      permissionBundles: ['SYSTEM_CONFIG', 'REPORTS_INSTITUTION', 'MODULES_MANAGE'],
    },
    {
      orgUnitCode: 'REG',
      code: 'REG',
      title: 'Registrar',
      level: 2,
      scope: 'ENTITY',
      permissionBundles: ['STUDENTS_FULL', 'ORG_MANAGE', 'REPORTS_ENTITY'],
    },
    {
      orgUnitCode: 'FIN',
      code: 'BURSAR',
      title: 'Bursar',
      level: 3,
      scope: 'UNIT',
      permissionBundles: ['FINANCE_FULL', 'BILLING_VIEW'],
    },
    {
      orgUnitCode: 'ENG',
      code: 'DEAN',
      title: 'Dean of Engineering',
      level: 3,
      scope: 'FACULTY',
      permissionBundles: ['REPORTS_DEPARTMENT', 'GRADES_APPROVE', 'CURRICULUM_MANAGE'],
    },
    {
      orgUnitCode: 'CSE',
      code: 'HOD',
      title: 'Head of Department',
      level: 4,
      scope: 'DEPARTMENT',
      permissionBundles: ['GRADES_APPROVE', 'STAFF_VIEW', 'REPORTS_DEPARTMENT'],
    },
    {
      orgUnitCode: 'BSCS',
      code: 'PC',
      title: 'Programme Coordinator',
      level: 5,
      scope: 'PROGRAMME',
      permissionBundles: ['ENROLLMENT_MANAGE', 'GRADES_ENTER'],
    },
  ],
};

const SATELLITE_TEMPLATE: EntityOrgTemplate = {
  units: [
    { code: 'REG', name: 'Campus Registry', type: 'ADMIN_UNIT', sortOrder: 1 },
    {
      code: 'FAC',
      name: 'Academic Division',
      type: 'FACULTY',
      sortOrder: 2,
      children: [{ code: 'GEN', name: 'General Studies', type: 'DEPARTMENT', sortOrder: 1 }],
    },
  ],
  positions: [
    {
      orgUnitCode: 'REG',
      code: 'PRINCIPAL',
      title: 'Campus Principal',
      level: 2,
      scope: 'ENTITY',
      permissionBundles: ['STUDENTS_FULL', 'ORG_MANAGE', 'REPORTS_ENTITY'],
    },
    {
      orgUnitCode: 'REG',
      code: 'REG',
      title: 'Campus Registrar',
      level: 2,
      scope: 'ENTITY',
      permissionBundles: ['STUDENTS_FULL', 'ORG_VIEW'],
    },
    {
      orgUnitCode: 'FAC',
      code: 'DEAN',
      title: 'Dean',
      level: 3,
      scope: 'FACULTY',
      permissionBundles: ['REPORTS_DEPARTMENT', 'CURRICULUM_MANAGE'],
    },
  ],
};

const AFFILIATE_TEMPLATE: EntityOrgTemplate = {
  units: [{ code: 'API', name: 'Affiliate API Desk', type: 'ADMIN_UNIT', sortOrder: 1 }],
  positions: [
    {
      orgUnitCode: 'API',
      code: 'COORD',
      title: 'Affiliate Coordinator',
      level: 4,
      scope: 'UNIT',
      permissionBundles: ['STUDENTS_VIEW'],
    },
  ],
};

const TEMPLATES: Partial<Record<InstitutionEntityType, EntityOrgTemplate>> = {
  MAIN_CAMPUS: MAIN_CAMPUS_TEMPLATE,
  SCHOOL: MAIN_CAMPUS_TEMPLATE,
  EXTRAMURAL: SATELLITE_TEMPLATE,
  DISTANCE_LEARNING: SATELLITE_TEMPLATE,
  SATELLITE_CAMPUS: SATELLITE_TEMPLATE,
  PROFESSIONAL_SCHOOL: MAIN_CAMPUS_TEMPLATE,
  SUMMER_SCHOOL: SATELLITE_TEMPLATE,
  RESEARCH_INSTITUTE: {
    units: [{ code: 'RES', name: 'Research Administration', type: 'ADMIN_UNIT', sortOrder: 1 }],
    positions: [
      {
        orgUnitCode: 'RES',
        code: 'DIR',
        title: 'Institute Director',
        level: 3,
        scope: 'ENTITY',
        permissionBundles: ['REPORTS_ENTITY'],
      },
    ],
  },
  CONSTITUENT_COLLEGE: SATELLITE_TEMPLATE,
  AFFILIATE: AFFILIATE_TEMPLATE,
};

export function orgTemplateForEntityType(type: InstitutionEntityType): EntityOrgTemplate {
  return TEMPLATES[type] ?? SATELLITE_TEMPLATE;
}
