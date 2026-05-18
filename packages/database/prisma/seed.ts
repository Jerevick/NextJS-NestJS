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
          { module: TenantModule.HR, enabled: true },
          { module: TenantModule.FINANCE, enabled: true },
          { module: TenantModule.ELECTIONS, enabled: true },
          { module: TenantModule.MEETINGS, enabled: true },
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
          componentWeights: [
            { key: 'coursework', label: 'Coursework', weight: 0.35 },
            { key: 'midterm', label: 'Midterm', weight: 0.3 },
            { key: 'finalExam', label: 'Final exam', weight: 0.35 },
          ],
        },
        hr: {
          maxCreditHoursPerSemester: 18,
          blockWorkloadOverMax: true,
          defaultKpi: [
            { key: 'teaching', label: 'Teaching effectiveness', weight: 0.4 },
            { key: 'research', label: 'Research output', weight: 0.3 },
            { key: 'service', label: 'Institutional service', weight: 0.3 },
          ],
          kpiByPositionLevel: {
            '2': [
              { key: 'leadership', label: 'Academic leadership', weight: 0.35 },
              { key: 'teaching', label: 'Teaching quality', weight: 0.35 },
              { key: 'research', label: 'Research impact', weight: 0.3 },
            ],
            '3': [
              { key: 'teaching', label: 'Teaching effectiveness', weight: 0.5 },
              { key: 'service', label: 'Department service', weight: 0.25 },
              { key: 'research', label: 'Research output', weight: 0.25 },
            ],
          },
          roleExpectationsByPositionCode: {
            PC: {
              duties: [
                'Coordinate programme delivery and timetabling',
                'Monitor student progress and assessment quality',
              ],
              responsibilities: [
                'Line-manage academic staff in the programme',
                'Report programme performance to the Head of Department',
              ],
            },
            HOD: {
              duties: [
                'Lead departmental academic planning',
                'Oversee staff development and appraisals',
              ],
              responsibilities: [
                'Accountable to the Dean for departmental outcomes',
                'Endorse appraisal outcomes before faculty review',
              ],
            },
          },
          defaultRoleExpectations: {
            duties: [
              'Deliver assigned teaching and assessment',
              'Participate in departmental meetings and committees',
            ],
            responsibilities: [
              'Meet professional standards for the role',
              'Support institutional policies and student welfare',
            ],
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
      { code: 'alumni.read', label: 'Read alumni directory and mentorship matches' },
      { code: 'alumni.write', label: 'Manage alumni profiles' },
      { code: 'enrollments.read', label: 'Read enrollments' },
      { code: 'enrollments.write', label: 'Manage enrollments' },
      { code: 'grades.read', label: 'Read grades' },
      { code: 'grades.write', label: 'Manage grades and grading scales' },
      { code: 'grades.enter', label: 'Enter grades for assigned sections' },
      {
        code: 'grades.approve_board',
        label: 'Final grade approval (e.g. faculty board / examiners)',
      },
      {
        code: 'grades.amend_approved',
        label: 'Amend grades after final approval (e.g. registrar)',
      },
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
      { code: 'finance.read', label: 'Read student ledger and fee structures' },
      { code: 'finance.write', label: 'Post charges, payments, and manage fee structures' },
      { code: 'lms.read', label: 'Read LMS course content and structure' },
      { code: 'lms.write', label: 'Manage LMS courses, modules, and lessons' },
      { code: 'backfill.request', label: 'Submit and cancel backfill requests' },
      { code: 'backfill.read', label: 'Read backfill requests' },
      {
        code: 'backfill.approve',
        label: 'Approve or reject backfill requests (retroactive billing)',
      },
      { code: 'billing.disputes.resolve', label: 'Resolve billing disputes on invoices' },
      { code: 'students.reactivate', label: 'Approve or reject student reactivation requests' },
      { code: 'students.permanent_delete', label: 'Initiate permanent student deletion workflow' },
      { code: 'org.read', label: 'Read org structure and positions' },
      { code: 'org.write', label: 'Manage org structure and positions' },
      { code: 'workflow.read', label: 'Read workflow instances' },
      { code: 'workflow.act', label: 'Act on workflow approval steps' },
      { code: 'progression.read', label: 'Read academic progression rules, decisions, and holds' },
      {
        code: 'progression.write',
        label: 'Manage academic progression rules, decisions, and holds',
      },
      { code: 'staff.read', label: 'Read staff directory, leave, and workload' },
      { code: 'staff.write', label: 'Manage staff profiles, leave types, and workload' },
      { code: 'elections.read', label: 'View elections and cast ballots' },
      { code: 'elections.manage', label: 'Manage elections, certify and publish results' },
      { code: 'meetings.read', label: 'View meetings, agendas, and resolution register' },
      { code: 'meetings.convene', label: 'Convene meetings and approve minutes' },
      { code: 'meetings.write', label: 'Full meeting administration' },
    ],
    skipDuplicates: true,
  });

  for (const bundle of [
    {
      code: 'ELECTIONS_MANAGE',
      name: 'Elections administration',
      permissions: ['elections.read', 'elections.manage'],
    },
    {
      code: 'MEETINGS_CONVENE',
      name: 'Meetings convene & minutes',
      permissions: ['meetings.read', 'meetings.convene', 'meetings.write'],
    },
  ]) {
    await prisma.permissionBundle.upsert({
      where: { institutionId_code: { institutionId: demo.id, code: bundle.code } },
      create: {
        institutionId: demo.id,
        code: bundle.code,
        name: bundle.name,
        permissions: bundle.permissions,
      },
      update: { name: bundle.name, permissions: bundle.permissions },
    });
  }

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
    'finance.read',
    'finance.write',
    'academic.read',
    'enrollments.read',
    'org.read',
    'org.write',
    'workflow.read',
    'workflow.act',
    'backfill.request',
    'backfill.read',
    'students.permanent_delete',
    'progression.read',
    'progression.write',
    'staff.read',
    'staff.write',
    'elections.read',
    'elections.manage',
    'meetings.read',
    'meetings.convene',
    'meetings.write',
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
    {
      code: 'STUDENTS_FULL',
      name: 'Students — full',
      permissions: ['students.read', 'students.write'],
    },
    {
      code: 'REPORTS_INSTITUTION',
      name: 'Reports — institution',
      permissions: ['institutions.read', 'billing.read', 'students.read'],
    },
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
        {
          institutionId: demo.id,
          entityId: mainCampus.id,
          orgUnitId: reg.id,
          code: 'HR_DIRECTOR',
          title: 'HR Director',
          level: 2,
          scope: 'INSTITUTION',
          permissionBundles: ['ORG_MANAGE'],
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
    const hrDirPos = await prisma.position.findFirst({
      where: {
        institutionId: demo.id,
        entityId: mainCampus.id,
        code: 'HR_DIRECTOR',
        deletedAt: null,
      },
    });
    if (hrDirPos) {
      const existingHr = await prisma.positionHolder.findFirst({
        where: { institutionId: demo.id, positionId: hrDirPos.id, endDate: null },
      });
      if (!existingHr) {
        await prisma.positionHolder.create({
          data: {
            institutionId: demo.id,
            entityId: mainCampus.id,
            positionId: hrDirPos.id,
            userId: registrarUser.id,
            startDate: new Date('2025-01-01'),
            appointedById: registrarUser.id,
            isActing: true,
          },
        });
      }
    }
  }

  const workflowDefs = [
    {
      code: 'STUDENT_REACTIVATION',
      name: 'Student reactivation',
      scope: 'ENTITY' as const,
      triggerEntity: 'ReactivationRequest',
      steps: [
        {
          stepNumber: 1,
          name: 'HoD recommendation',
          assignedTo: { positionCode: 'HOD' },
          slaHours: 48,
          scope: 'ENTITY',
        },
        {
          stepNumber: 2,
          name: 'Dean endorsement',
          assignedTo: { positionCode: 'DEAN' },
          slaHours: 48,
          scope: 'ENTITY',
        },
        {
          stepNumber: 3,
          name: 'Registrar confirmation',
          assignedTo: { positionCode: 'REG' },
          slaHours: 24,
          scope: 'ENTITY',
        },
      ],
    },
    {
      code: 'BACKFILL_REQUEST',
      name: 'Academic backfill',
      scope: 'ENTITY' as const,
      triggerEntity: 'BackfillRequest',
      steps: [
        {
          stepNumber: 1,
          name: 'HoD academic review',
          assignedTo: { positionCode: 'HOD' },
          slaHours: 72,
          scope: 'ENTITY',
        },
        {
          stepNumber: 2,
          name: 'Dean approval',
          assignedTo: { positionCode: 'DEAN' },
          slaHours: 72,
          scope: 'ENTITY',
        },
        {
          stepNumber: 3,
          name: 'Registrar final approval',
          assignedTo: { positionCode: 'REG' },
          slaHours: 48,
          scope: 'ENTITY',
        },
        {
          stepNumber: 4,
          name: 'Finance retroactive billing',
          assignedTo: { positionCode: 'BURSAR' },
          slaHours: 48,
          scope: 'INSTITUTION',
        },
      ],
    },
    {
      code: 'STUDENT_PERMANENT_DELETION',
      name: 'Permanent student deletion',
      scope: 'INSTITUTION' as const,
      triggerEntity: 'Student',
      steps: [
        {
          stepNumber: 1,
          name: 'Registrar initiate',
          assignedTo: { positionCode: 'REG' },
          slaHours: 0,
          scope: 'INSTITUTION',
        },
        {
          stepNumber: 2,
          name: 'Deputy VC approval',
          assignedTo: { positionCode: 'DVC' },
          slaHours: 72,
          scope: 'INSTITUTION',
        },
        {
          stepNumber: 3,
          name: 'Finance zero balance',
          assignedTo: { positionCode: 'BURSAR' },
          slaHours: 48,
          scope: 'INSTITUTION',
        },
      ],
    },
    {
      code: 'GRADUATION_CLEARANCE',
      name: 'Graduation clearance',
      scope: 'ENTITY' as const,
      triggerEntity: 'GraduationClearanceRequest',
      steps: [
        {
          stepNumber: 1,
          name: 'Programme coordinator (credits)',
          assignedTo: { positionCode: 'PC' },
          slaHours: 72,
          scope: 'ENTITY',
        },
        {
          stepNumber: 2,
          name: 'HoD certification',
          assignedTo: { positionCode: 'HOD' },
          slaHours: 48,
          scope: 'ENTITY',
        },
        {
          stepNumber: 3,
          name: 'Dean endorsement',
          assignedTo: { positionCode: 'DEAN' },
          slaHours: 48,
          scope: 'ENTITY',
        },
        {
          stepNumber: 4,
          name: 'Registrar confirmation',
          assignedTo: { positionCode: 'REG' },
          slaHours: 24,
          scope: 'ENTITY',
        },
        {
          stepNumber: 5,
          name: 'Finance clearance',
          assignedTo: { positionCode: 'BURSAR' },
          slaHours: 48,
          scope: 'INSTITUTION',
        },
      ],
    },
    {
      code: 'ACADEMIC_PROGRESSION_CONDITIONAL',
      name: 'Conditional academic promotion',
      scope: 'ENTITY' as const,
      triggerEntity: 'ProgressionDecision',
      steps: [
        {
          stepNumber: 1,
          name: 'Registrar review',
          assignedTo: { positionCode: 'REG' },
          slaHours: 48,
          scope: 'ENTITY',
        },
        {
          stepNumber: 2,
          name: 'Dean confirmation',
          assignedTo: { positionCode: 'DEAN' },
          slaHours: 48,
          scope: 'ENTITY',
        },
      ],
    },
    {
      code: 'ACADEMIC_PROGRESSION_FULL_REPEAT',
      name: 'Full session repeat',
      scope: 'ENTITY' as const,
      triggerEntity: 'ProgressionDecision',
      steps: [
        {
          stepNumber: 1,
          name: 'HoD academic plan',
          assignedTo: { positionCode: 'HOD' },
          slaHours: 72,
          scope: 'ENTITY',
        },
        {
          stepNumber: 2,
          name: 'Registrar records update',
          assignedTo: { positionCode: 'REG' },
          slaHours: 48,
          scope: 'ENTITY',
        },
      ],
    },
    {
      code: 'ACADEMIC_PROGRESSION_MAX_DURATION',
      name: 'Maximum programme duration review',
      scope: 'INSTITUTION' as const,
      triggerEntity: 'ProgressionDecision',
      steps: [
        {
          stepNumber: 1,
          name: 'Deputy VC extension',
          assignedTo: { positionCode: 'DVC' },
          slaHours: 120,
          scope: 'INSTITUTION',
        },
        {
          stepNumber: 2,
          name: 'Registrar decision',
          assignedTo: { positionCode: 'REG' },
          slaHours: 48,
          scope: 'INSTITUTION',
        },
      ],
    },
    {
      code: 'ACADEMIC_PROGRESSION_MANUAL',
      name: 'Manual progression review',
      scope: 'ENTITY' as const,
      triggerEntity: 'ProgressionDecision',
      steps: [
        {
          stepNumber: 1,
          name: 'Registrar adjudication',
          assignedTo: { positionCode: 'REG' },
          slaHours: 72,
          scope: 'ENTITY',
        },
      ],
    },
    {
      code: 'AEGROTAT',
      name: 'Aegrotat progression',
      scope: 'ENTITY' as const,
      triggerEntity: 'ProgressionDecision',
      steps: [
        {
          stepNumber: 1,
          name: 'HoD academic review',
          assignedTo: { positionCode: 'HOD' },
          slaHours: 72,
          scope: 'ENTITY',
        },
        {
          stepNumber: 2,
          name: 'Dean approval',
          assignedTo: { positionCode: 'DEAN' },
          slaHours: 48,
          scope: 'ENTITY',
        },
        {
          stepNumber: 3,
          name: 'Registrar confirmation',
          assignedTo: { positionCode: 'REG' },
          slaHours: 48,
          scope: 'ENTITY',
        },
      ],
    },
    {
      code: 'FEE_WAIVER',
      name: 'Fee waiver approval',
      scope: 'ENTITY' as const,
      triggerEntity: 'FinanceTransaction',
      steps: [
        {
          stepNumber: 1,
          name: 'Finance Director approval',
          assignedTo: { positionCode: 'BURSAR' },
          slaHours: 72,
          scope: 'INSTITUTION',
        },
      ],
    },
    {
      code: 'FINANCE_REFUND',
      name: 'Finance refund approval',
      scope: 'ENTITY' as const,
      triggerEntity: 'FinanceTransaction',
      steps: [
        {
          stepNumber: 1,
          name: 'Finance Director approval',
          assignedTo: { positionCode: 'BURSAR' },
          slaHours: 72,
          scope: 'INSTITUTION',
        },
        {
          stepNumber: 2,
          name: 'Registrar acknowledgement',
          assignedTo: { positionCode: 'REG' },
          slaHours: 48,
          scope: 'ENTITY',
        },
      ],
    },
    {
      code: 'SCHOLARSHIP_APPLICATION',
      name: 'Scholarship application review',
      scope: 'ENTITY' as const,
      triggerEntity: 'FinanceScholarshipApplication',
      steps: [
        {
          stepNumber: 1,
          name: 'Finance Director review',
          assignedTo: { positionCode: 'BURSAR' },
          slaHours: 72,
          scope: 'INSTITUTION',
        },
      ],
    },
    {
      code: 'SCHOLARSHIP_AWARD',
      name: 'Scholarship award approval',
      scope: 'ENTITY' as const,
      triggerEntity: 'FinanceScholarshipAward',
      steps: [
        {
          stepNumber: 1,
          name: 'Finance Director review',
          assignedTo: { positionCode: 'BURSAR' },
          slaHours: 72,
          scope: 'INSTITUTION',
        },
        {
          stepNumber: 2,
          name: 'Registrar acknowledgement',
          assignedTo: { positionCode: 'REG' },
          slaHours: 48,
          scope: 'ENTITY',
        },
      ],
    },
    {
      code: 'LEAVE_REQUEST',
      name: 'Staff leave request',
      scope: 'ENTITY' as const,
      triggerEntity: 'LeaveRequest',
      steps: [
        {
          stepNumber: 1,
          name: 'Line manager (PC)',
          assignedTo: { positionCode: 'PC' },
          slaHours: 48,
          scope: 'ENTITY',
        },
        {
          stepNumber: 2,
          name: 'Head of Department',
          assignedTo: { positionCode: 'HOD' },
          slaHours: 48,
          scope: 'ENTITY',
        },
        {
          stepNumber: 3,
          name: 'HR Director approval',
          assignedTo: { positionCode: 'HR_DIRECTOR' },
          slaHours: 72,
          scope: 'INSTITUTION',
        },
      ],
    },
    {
      code: 'STAFF_APPRAISAL',
      name: 'Staff performance appraisal',
      scope: 'ENTITY' as const,
      triggerEntity: 'StaffAppraisal',
      steps: [
        {
          stepNumber: 1,
          name: 'Immediate head review',
          assignedTo: { positionCode: 'PC' },
          slaHours: 72,
          scope: 'ENTITY',
        },
        {
          stepNumber: 2,
          name: 'HoD endorsement',
          assignedTo: { positionCode: 'HOD' },
          slaHours: 72,
          scope: 'ENTITY',
        },
        {
          stepNumber: 3,
          name: 'Dean endorsement',
          assignedTo: { positionCode: 'DEAN' },
          slaHours: 72,
          scope: 'FACULTY',
        },
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

  const hodPos = await prisma.position.findFirst({
    where: {
      institutionId: demo.id,
      entityId: mainCampus.id,
      code: 'HOD',
      deletedAt: null,
    },
  });
  const cseUnit = await prisma.orgUnit.findFirst({
    where: {
      institutionId: demo.id,
      entityId: mainCampus.id,
      code: 'CSE',
      deletedAt: null,
    },
  });
  const existingStaff = await prisma.staffProfile.findFirst({
    where: { institutionId: demo.id, userId: registrarUser.id, deletedAt: null },
  });
  if (!existingStaff && hodPos && cseUnit) {
    await prisma.staffProfile.create({
      data: {
        institutionId: demo.id,
        entityId: mainCampus.id,
        userId: registrarUser.id,
        staffNumber: 'STF-0001',
        orgUnitId: cseUnit.id,
        positionId: hodPos.id,
        employmentType: 'FULL_TIME',
        contractStart: new Date('2025-01-01'),
      },
    });
  }

  const leaveTypeCount = await prisma.leaveType.count({
    where: { institutionId: demo.id, entityId: mainCampus.id },
  });
  if (leaveTypeCount === 0) {
    await prisma.leaveType.createMany({
      data: [
        {
          institutionId: demo.id,
          entityId: mainCampus.id,
          code: 'ANNUAL',
          name: 'Annual leave',
          annualAllocation: 21,
          requiresApproval: true,
        },
        {
          institutionId: demo.id,
          entityId: mainCampus.id,
          code: 'SICK',
          name: 'Sick leave',
          annualAllocation: 10,
          requiresApproval: true,
        },
      ],
    });
  }

  for (const mod of [TenantModule.ELECTIONS, TenantModule.MEETINGS] as const) {
    await prisma.institutionModule.upsert({
      where: { institutionId_module: { institutionId: demo.id, module: mod } },
      create: { institutionId: demo.id, module: mod, enabled: true },
      update: { enabled: true },
    });
  }

  const electionCount = await prisma.election.count({
    where: { institutionId: demo.id, entityId: mainCampus.id },
  });
  if (electionCount === 0 && hodPos) {
    const now = new Date();
    const nomOpen = new Date(now.getTime() - 7 * 86_400_000);
    const nomClose = new Date(now.getTime() + 7 * 86_400_000);
    const voteOpen = new Date(now.getTime() + 8 * 86_400_000);
    const voteClose = new Date(now.getTime() + 14 * 86_400_000);
    await prisma.election.create({
      data: {
        institutionId: demo.id,
        entityId: mainCampus.id,
        title: 'Student Guild President 2026',
        description: 'Campus-wide student leadership election (demo).',
        type: 'STUDENT_GOVERNMENT',
        eligibilityRules: { enrollmentStatuses: ['ACTIVE'] },
        positions: [{ title: 'President', description: 'Guild president', maxCandidates: 5 }],
        nominationOpenDate: nomOpen,
        nominationCloseDate: nomClose,
        votingOpenDate: voteOpen,
        votingCloseDate: voteClose,
        status: 'NOMINATIONS_OPEN',
      },
    });
  }

  const meetingCount = await prisma.meeting.count({
    where: { institutionId: demo.id, entityId: mainCampus.id },
  });
  if (meetingCount === 0 && hodPos && cseUnit) {
    const scheduled = new Date(Date.now() + 3 * 86_400_000);
    await prisma.meeting.create({
      data: {
        institutionId: demo.id,
        entityId: mainCampus.id,
        title: 'Faculty Board — Q2 Planning',
        type: 'FACULTY_BOARD',
        convenerPositionId: hodPos.id,
        orgUnitId: cseUnit.id,
        scheduledAt: scheduled,
        durationMinutes: 90,
        location: 'Senate Chamber',
        meetingLink: 'https://teams.microsoft.com/l/meetup-join/demo',
        quorumRequired: 3,
        agenda: [
          { itemNumber: '1', title: 'Opening', duration: 10, type: 'INFORMATION' },
          { itemNumber: '2', title: 'Workload review', duration: 45, type: 'DISCUSSION' },
        ],
        attendees: {
          create: {
            institutionId: demo.id,
            entityId: mainCampus.id,
            userId: registrarUser.id,
            inviteStatus: 'ACCEPTED',
            isRequired: true,
          },
        },
        agendaItems: {
          create: [
            {
              institutionId: demo.id,
              entityId: mainCampus.id,
              itemNumber: '1',
              title: 'Opening remarks',
              order: 0,
              duration: 10,
              type: 'INFORMATION',
            },
            {
              institutionId: demo.id,
              entityId: mainCampus.id,
              itemNumber: '2',
              title: 'Workload review',
              order: 1,
              duration: 45,
              type: 'DISCUSSION',
            },
          ],
        },
      },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
