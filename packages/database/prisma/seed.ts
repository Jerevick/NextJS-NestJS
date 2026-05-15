import {
  PrismaClient,
  TenantModule,
  UserRole,
  PlanTier,
  InstitutionStatus,
  ProgramType,
  SemesterType,
  SectionMode,
  BillingCycle,
  InvoiceStatus,
  InstitutionEntityType,
  InstitutionEntityStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  await prisma.platform.upsert({
    where: { id: 'default' },
    create: { id: 'default', settings: {} },
    update: {},
  });

  const demoPassword = await bcrypt.hash('Demo12345!', 12);

  const demo = await prisma.institution.upsert({
    where: { slug: 'demo-university' },
    create: {
      slug: 'demo-university',
      name: 'Demo University',
      plan: PlanTier.STARTER,
      status: InstitutionStatus.ACTIVE,
      settings: { studentNumberFormat: '{year}/{code}/{seq}' },
      maxStudents: 500,
      modules: {
        create: [
          { module: TenantModule.SIS, enabled: true },
          { module: TenantModule.LMS, enabled: true },
        ],
      },
    },
    update: {},
  });

  await prisma.institution.update({
    where: { id: demo.id },
    data: {
      settings: {
        studentNumberFormat: '{year}/{code}/{seq}',
        enrollment: { addDropPeriodDays: 120, allowEnrollmentBeforeStartDays: 14 },
        grades: {
          governance: {
            approvePermissionCodes: ['grades.approve_board', 'grades.write'],
            postApprovalEditPermissionCodes: ['grades.write', 'grades.amend_approved'],
          },
        },
      },
    },
  });

  await prisma.institutionEntity.upsert({
    where: { institutionId_code: { institutionId: demo.id, code: 'MAIN' } },
    create: {
      institutionId: demo.id,
      code: 'MAIN',
      name: 'Demo University — Main Campus',
      type: InstitutionEntityType.MAIN_CAMPUS,
      status: InstitutionEntityStatus.ACTIVE,
    },
    update: {
      name: 'Demo University — Main Campus',
      deletedAt: null,
      status: InstitutionEntityStatus.ACTIVE,
    },
  });

  const mainCampus = await prisma.institutionEntity.findFirstOrThrow({
    where: { institutionId: demo.id, code: 'MAIN', deletedAt: null },
  });

  await prisma.user.upsert({
    where: {
      institutionId_email: {
        institutionId: demo.id,
        email: 'superadmin@demo.local',
      },
    },
    create: {
      institutionId: demo.id,
      email: 'superadmin@demo.local',
      passwordHash: demoPassword,
      role: UserRole.SUPER_ADMIN,
      profile: { firstName: 'Super', lastName: 'Admin' },
      isActive: true,
    },
    update: {
      passwordHash: demoPassword,
    },
  });

  await prisma.permission.createMany({
    data: [
      { code: 'institutions.read', label: 'Read institutions' },
      { code: 'institutions.write', label: 'Manage institutions' },
      { code: 'students.read', label: 'Read students' },
      { code: 'students.write', label: 'Manage students' },
      { code: 'enrollments.read', label: 'Read enrollments' },
      { code: 'enrollments.write', label: 'Manage enrollments' },
      { code: 'grades.read', label: 'Read grades' },
      { code: 'grades.write', label: 'Manage grades and grading scales' },
      { code: 'grades.enter', label: 'Enter grades for assigned sections' },
      { code: 'grades.approve_board', label: 'Final grade approval (e.g. faculty board / examiners)' },
      { code: 'grades.amend_approved', label: 'Amend grades after final approval (e.g. registrar)' },
      { code: 'attendance.read', label: 'Read attendance' },
      { code: 'attendance.write', label: 'Manage attendance' },
      { code: 'attendance.enter', label: 'Mark attendance for assigned sections' },
      { code: 'documents.read', label: 'Read documents and templates' },
      { code: 'documents.write', label: 'Manage documents and templates' },
      { code: 'admissions.read', label: 'Read admissions cycles and applications' },
      { code: 'admissions.write', label: 'Manage admissions cycles and applications' },
      { code: 'rooms.read', label: 'Read rooms and facilities' },
      { code: 'rooms.write', label: 'Manage rooms and facilities' },
      { code: 'academic.read', label: 'Read academic structure, sections, and timetables' },
      { code: 'academic.write', label: 'Manage academic structure, sections, and timetables' },
      { code: 'audit.read', label: 'Read institution audit trail' },
      { code: 'billing.read', label: 'Read subscriptions and invoices' },
      { code: 'billing.write', label: 'Manage billing (future Stripe integration)' },
      { code: 'lms.read', label: 'Read LMS course content and structure' },
      { code: 'lms.write', label: 'Manage LMS courses, modules, and lessons' },
      { code: 'backfill.request', label: 'Submit and cancel backfill requests' },
      { code: 'backfill.read', label: 'Read backfill requests' },
      { code: 'backfill.approve', label: 'Approve or reject backfill requests (retroactive billing)' },
      { code: 'billing.disputes.resolve', label: 'Resolve billing disputes on invoices' },
      { code: 'students.reactivate', label: 'Approve or reject student reactivation requests' },
      { code: 'students.permanent_delete', label: 'Initiate permanent student deletion workflow' },
      { code: 'org.read', label: 'Read org structure and positions' },
      { code: 'org.write', label: 'Manage org structure and positions' },
      { code: 'workflow.read', label: 'Read workflow instances' },
      { code: 'workflow.act', label: 'Act on workflow approval steps' },
    ],
    skipDuplicates: true,
  });

  /** Demo user with institution-wide JWT scope (entityScope ALL) via `institutions.write`, not SUPER_ADMIN. */
  const registrarRole = await prisma.role.upsert({
    where: { institutionId_code: { institutionId: demo.id, code: 'INST_REGISTRAR' } },
    create: {
      institutionId: demo.id,
      name: 'Institution Registrar (demo)',
      code: 'INST_REGISTRAR',
    },
    update: { name: 'Institution Registrar (demo)' },
  });
  const registrarPermCodes = [
    'institutions.write',
    'institutions.read',
    'students.read',
    'students.write',
    'billing.read',
    'academic.read',
    'enrollments.read',
    'org.read',
    'org.write',
    'workflow.read',
    'workflow.act',
    'backfill.request',
    'backfill.read',
    'students.permanent_delete',
  ] as const;
  const registrarPerms = await prisma.permission.findMany({
    where: { code: { in: [...registrarPermCodes] } },
    select: { id: true },
  });
  await prisma.rolePermission.deleteMany({ where: { roleId: registrarRole.id } });
  if (registrarPerms.length > 0) {
    await prisma.rolePermission.createMany({
      data: registrarPerms.map((p) => ({ roleId: registrarRole.id, permissionId: p.id })),
    });
  }
  const registrarUser = await prisma.user.upsert({
    where: {
      institutionId_email: {
        institutionId: demo.id,
        email: 'registrar@demo.local',
      },
    },
    create: {
      institutionId: demo.id,
      email: 'registrar@demo.local',
      passwordHash: demoPassword,
      role: UserRole.STAFF,
      profile: { firstName: 'Demo', lastName: 'Registrar' },
      isActive: true,
    },
    update: {
      passwordHash: demoPassword,
    },
  });
  await prisma.userRoleAssignment.upsert({
    where: {
      userId_roleId: { userId: registrarUser.id, roleId: registrarRole.id },
    },
    create: { userId: registrarUser.id, roleId: registrarRole.id },
    update: {},
  });

  const division = await prisma.academicDivision.upsert({
    where: {
      institutionId_code: { institutionId: demo.id, code: 'ENG' },
    },
    create: {
      institutionId: demo.id,
      name: 'Engineering',
      code: 'ENG',
    },
    update: {},
  });

  const department = await prisma.department.upsert({
    where: {
      institutionId_code: { institutionId: demo.id, code: 'CSE' },
    },
    create: {
      institutionId: demo.id,
      divisionId: division.id,
      name: 'Computer Science',
      code: 'CSE',
    },
    update: {},
  });

  await prisma.program.upsert({
    where: {
      institutionId_code: { institutionId: demo.id, code: 'BSCS' },
    },
    create: {
      institutionId: demo.id,
      departmentId: department.id,
      entityId: mainCampus.id,
      name: 'B.Sc. Computer Science',
      code: 'BSCS',
      type: ProgramType.UNDERGRADUATE,
      durationYears: 4,
      creditHours: 120,
    },
    update: { entityId: mainCampus.id },
  });

  let academicYear = await prisma.academicYear.findFirst({
    where: { institutionId: demo.id, name: '2025-2026', deletedAt: null },
  });
  if (!academicYear) {
    academicYear = await prisma.academicYear.create({
      data: {
        institutionId: demo.id,
        name: '2025-2026',
        startDate: new Date('2025-09-01'),
        endDate: new Date('2026-08-31'),
        isCurrent: true,
      },
    });
  }

  let semester = await prisma.semester.findFirst({
    where: { institutionId: demo.id, name: 'Spring 2026', deletedAt: null },
  });
  if (!semester) {
    semester = await prisma.semester.create({
      data: {
        academicYearId: academicYear.id,
        institutionId: demo.id,
        name: 'Spring 2026',
        startDate: new Date('2026-01-15'),
        endDate: new Date('2026-06-30'),
        type: SemesterType.REGULAR,
      },
    });
  }

  const courseIntro = await prisma.course.upsert({
    where: { institutionId_code: { institutionId: demo.id, code: 'CS101' } },
    create: {
      institutionId: demo.id,
      entityId: mainCampus.id,
      departmentId: department.id,
      code: 'CS101',
      title: 'Introduction to Computer Science',
      creditHours: 3,
      prerequisites: [],
    },
    update: { entityId: mainCampus.id },
  });

  const existingSection = await prisma.section.findFirst({
    where: {
      courseId: courseIntro.id,
      semesterId: semester.id,
      institutionId: demo.id,
      deletedAt: null,
    },
  });
  if (!existingSection) {
    await prisma.section.create({
      data: {
        courseId: courseIntro.id,
        semesterId: semester.id,
        institutionId: demo.id,
        entityId: courseIntro.entityId,
        maxEnrollment: 40,
        mode: SectionMode.IN_PERSON,
      },
    });
  }

  const defaultScaleBands = [
    { min: 93, max: 100, letter: 'A', points: 4 },
    { min: 90, max: 92.99, letter: 'A-', points: 3.7 },
    { min: 87, max: 89.99, letter: 'B+', points: 3.3 },
    { min: 83, max: 86.99, letter: 'B', points: 3 },
    { min: 80, max: 82.99, letter: 'B-', points: 2.7 },
    { min: 77, max: 79.99, letter: 'C+', points: 2.3 },
    { min: 73, max: 76.99, letter: 'C', points: 2 },
    { min: 70, max: 72.99, letter: 'C-', points: 1.7 },
    { min: 0, max: 69.99, letter: 'F', points: 0 },
  ];

  const existingScale = await prisma.gradingScale.findFirst({
    where: { institutionId: demo.id, name: 'Default 4.0', deletedAt: null },
  });
  if (!existingScale) {
    await prisma.gradingScale.create({
      data: {
        institutionId: demo.id,
        name: 'Default 4.0',
        isDefault: true,
        scale: defaultScaleBands,
      },
    });
  }

  const existingSub = await prisma.subscription.findFirst({
    where: { institutionId: demo.id, deletedAt: null },
  });
  if (!existingSub) {
    await prisma.subscription.create({
      data: {
        institutionId: demo.id,
        planId: 'starter-annual',
        billingCycle: BillingCycle.ANNUAL,
        amount: 1200,
        currency: 'USD',
        nextBillingDate: new Date('2027-01-01'),
      },
    });
  }

  const existingInvoice = await prisma.invoice.findFirst({
    where: { institutionId: demo.id, deletedAt: null },
  });
  if (!existingInvoice) {
    await prisma.invoice.create({
      data: {
        institutionId: demo.id,
        amount: 1200,
        status: InvoiceStatus.PAID,
        dueDate: new Date('2026-01-15'),
        paidAt: new Date('2026-01-10'),
        lineItems: [{ description: 'Annual platform', quantity: 1, amount: 1200 }],
      },
    });
  }

  const bundleSeeds = [
    { code: 'ORG_MANAGE', name: 'Org structure — manage', permissions: ['org.read', 'org.write'] },
    { code: 'ORG_VIEW', name: 'Org structure — view', permissions: ['org.read'] },
    { code: 'STUDENTS_FULL', name: 'Students — full', permissions: ['students.read', 'students.write'] },
    { code: 'REPORTS_INSTITUTION', name: 'Reports — institution', permissions: ['institutions.read', 'billing.read', 'students.read'] },
  ];
  for (const b of bundleSeeds) {
    const exists = await prisma.permissionBundle.findFirst({
      where: { institutionId: demo.id, code: b.code, deletedAt: null },
    });
    if (!exists) {
      await prisma.permissionBundle.create({
        data: { institutionId: demo.id, ...b },
      });
    }
  }

  const mainOrgCount = await prisma.orgUnit.count({
    where: { institutionId: demo.id, entityId: mainCampus.id, deletedAt: null },
  });
  if (mainOrgCount === 0) {
    const reg = await prisma.orgUnit.create({
      data: {
        institutionId: demo.id,
        entityId: mainCampus.id,
        code: 'REG',
        name: 'Registry',
        type: 'ADMIN_UNIT',
        sortOrder: 1,
      },
    });
    const fin = await prisma.orgUnit.create({
      data: {
        institutionId: demo.id,
        entityId: mainCampus.id,
        code: 'FIN',
        name: 'Finance Office',
        type: 'ADMIN_UNIT',
        sortOrder: 2,
      },
    });
    const eng = await prisma.orgUnit.create({
      data: {
        institutionId: demo.id,
        entityId: mainCampus.id,
        code: 'ENG',
        name: 'Faculty of Engineering',
        type: 'FACULTY',
        sortOrder: 3,
      },
    });
    const cse = await prisma.orgUnit.create({
      data: {
        institutionId: demo.id,
        entityId: mainCampus.id,
        code: 'CSE',
        name: 'Department of Computer Science',
        type: 'DEPARTMENT',
        parentId: eng.id,
        sortOrder: 1,
      },
    });
    const bscs = await prisma.orgUnit.create({
      data: {
        institutionId: demo.id,
        entityId: mainCampus.id,
        code: 'BSCS',
        name: 'B.Sc. Computer Science',
        type: 'PROGRAMME',
        parentId: cse.id,
        sortOrder: 1,
      },
    });
    await prisma.position.createMany({
      data: [
        {
          institutionId: demo.id,
          entityId: mainCampus.id,
          orgUnitId: reg.id,
          code: 'VC',
          title: 'Vice-Chancellor',
          level: 1,
          scope: 'INSTITUTION',
          permissionBundles: ['REPORTS_INSTITUTION', 'ORG_MANAGE'],
        },
        {
          institutionId: demo.id,
          entityId: mainCampus.id,
          orgUnitId: reg.id,
          code: 'REG',
          title: 'Registrar',
          level: 2,
          scope: 'ENTITY',
          permissionBundles: ['STUDENTS_FULL', 'ORG_MANAGE'],
        },
        {
          institutionId: demo.id,
          entityId: mainCampus.id,
          orgUnitId: eng.id,
          code: 'DEAN',
          title: 'Dean of Engineering',
          level: 3,
          scope: 'FACULTY',
          permissionBundles: ['REPORTS_INSTITUTION'],
        },
        {
          institutionId: demo.id,
          entityId: mainCampus.id,
          orgUnitId: cse.id,
          code: 'HOD',
          title: 'Head of Department',
          level: 4,
          scope: 'DEPARTMENT',
          permissionBundles: ['ORG_VIEW'],
        },
        {
          institutionId: demo.id,
          entityId: mainCampus.id,
          orgUnitId: bscs.id,
          code: 'PC',
          title: 'Programme Coordinator',
          level: 5,
          scope: 'PROGRAMME',
          permissionBundles: ['STUDENTS_FULL'],
        },
        {
          institutionId: demo.id,
          entityId: mainCampus.id,
          orgUnitId: fin.id,
          code: 'BURSAR',
          title: 'Bursar',
          level: 3,
          scope: 'UNIT',
          permissionBundles: ['FINANCE_FULL'],
        },
      ],
    });
    const regPos = await prisma.position.findFirst({
      where: { institutionId: demo.id, entityId: mainCampus.id, code: 'REG', deletedAt: null },
    });
    if (regPos) {
      await prisma.positionHolder.create({
        data: {
          institutionId: demo.id,
          entityId: mainCampus.id,
          positionId: regPos.id,
          userId: registrarUser.id,
          startDate: new Date('2025-01-01'),
          appointedById: registrarUser.id,
        },
      });
    }
    const hodPos = await prisma.position.findFirst({
      where: { institutionId: demo.id, entityId: mainCampus.id, code: 'HOD', deletedAt: null },
    });
    if (hodPos) {
      await prisma.positionHolder.create({
        data: {
          institutionId: demo.id,
          entityId: mainCampus.id,
          positionId: hodPos.id,
          userId: registrarUser.id,
          startDate: new Date('2025-01-01'),
          appointedById: registrarUser.id,
          isActing: true,
        },
      });
    }
    const bursarPos = await prisma.position.findFirst({
      where: { institutionId: demo.id, entityId: mainCampus.id, code: 'BURSAR', deletedAt: null },
    });
    if (bursarPos) {
      await prisma.positionHolder.create({
        data: {
          institutionId: demo.id,
          entityId: mainCampus.id,
          positionId: bursarPos.id,
          userId: registrarUser.id,
          startDate: new Date('2025-01-01'),
          appointedById: registrarUser.id,
          isActing: true,
        },
      });
    }
  }

  const workflowDefs = [
    {
      code: 'STUDENT_REACTIVATION',
      name: 'Student reactivation',
      scope: 'ENTITY' as const,
      triggerEntity: 'ReactivationRequest',
      steps: [
        { stepNumber: 1, name: 'HoD recommendation', assignedTo: { positionCode: 'HOD' }, slaHours: 48, scope: 'ENTITY' },
        { stepNumber: 2, name: 'Dean endorsement', assignedTo: { positionCode: 'DEAN' }, slaHours: 48, scope: 'ENTITY' },
        { stepNumber: 3, name: 'Registrar confirmation', assignedTo: { positionCode: 'REG' }, slaHours: 24, scope: 'ENTITY' },
      ],
    },
    {
      code: 'BACKFILL_REQUEST',
      name: 'Academic backfill',
      scope: 'ENTITY' as const,
      triggerEntity: 'BackfillRequest',
      steps: [
        { stepNumber: 1, name: 'HoD academic review', assignedTo: { positionCode: 'HOD' }, slaHours: 72, scope: 'ENTITY' },
        { stepNumber: 2, name: 'Dean approval', assignedTo: { positionCode: 'DEAN' }, slaHours: 72, scope: 'ENTITY' },
        { stepNumber: 3, name: 'Registrar final approval', assignedTo: { positionCode: 'REG' }, slaHours: 48, scope: 'ENTITY' },
        { stepNumber: 4, name: 'Finance retroactive billing', assignedTo: { positionCode: 'BURSAR' }, slaHours: 48, scope: 'INSTITUTION' },
      ],
    },
    {
      code: 'STUDENT_PERMANENT_DELETION',
      name: 'Permanent student deletion',
      scope: 'INSTITUTION' as const,
      triggerEntity: 'Student',
      steps: [
        { stepNumber: 1, name: 'Registrar initiate', assignedTo: { positionCode: 'REG' }, slaHours: 0, scope: 'INSTITUTION' },
        { stepNumber: 2, name: 'Deputy VC approval', assignedTo: { positionCode: 'DVC' }, slaHours: 72, scope: 'INSTITUTION' },
        { stepNumber: 3, name: 'Finance zero balance', assignedTo: { positionCode: 'BURSAR' }, slaHours: 48, scope: 'INSTITUTION' },
      ],
    },
  ];
  for (const def of workflowDefs) {
    const exists = await prisma.workflowDefinition.findFirst({
      where: { institutionId: demo.id, entityId: null, code: def.code },
    });
    if (!exists) {
      await prisma.workflowDefinition.create({
        data: {
          institutionId: demo.id,
          name: def.name,
          code: def.code,
          scope: def.scope,
          triggerEntity: def.triggerEntity,
          steps: def.steps,
          isActive: true,
        },
      });
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
