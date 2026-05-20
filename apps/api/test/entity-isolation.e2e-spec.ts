/**
 * Cross-entity isolation against real PostgreSQL (Testcontainers).
 * Skipped when SKIP_TESTCONTAINERS=1 or Docker is unavailable.
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import type { AuthUser } from '../src/auth/auth.types';
import { PrismaService } from '../src/prisma/prisma.service';
import { StudentsRepository } from '../src/students/students.repository';
import { StudentsService } from '../src/students/students.service';

const runContainers = process.env.SKIP_TESTCONTAINERS !== '1';

(runContainers ? describe : describe.skip)('Entity isolation E2E (Testcontainers)', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaService;
  let students: StudentsService;

  let instA: string;
  let entA1: string;
  let entA2: string;
  let studentA1: string;
  let studentA2: string;

  beforeAll(async () => {
    jest.setTimeout(180_000);
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    const url = container.getConnectionUri();
    process.env.DATABASE_URL = url;

    const dbPackage = join(__dirname, '..', '..', '..', 'packages', 'database');
    execSync('pnpm exec prisma db push --skip-generate', {
      cwd: dbPackage,
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'pipe',
    });

    prisma = new PrismaService();
    const repo = new StudentsRepository(prisma);
    students = new StudentsService(
      repo,
      { append: jest.fn() } as never,
      { changeEnrollmentStatus: jest.fn() } as never,
      prisma,
      { initiateWorkflow: jest.fn() } as never,
      { evaluateStudent: jest.fn() } as never,
      { computeForStudent: jest.fn() } as never,
      { getEffectiveSettingForScope: jest.fn() } as never,
    );

    const inst = await prisma.institution.create({
      data: { name: 'Iso Test U', slug: 'iso-test-u', status: 'ACTIVE' },
    });
    instA = inst.id;
    const e1 = await prisma.institutionEntity.create({
      data: {
        institutionId: instA,
        code: 'MAIN',
        name: 'Main',
        type: 'MAIN_CAMPUS',
        status: 'ACTIVE',
      },
    });
    const e2 = await prisma.institutionEntity.create({
      data: {
        institutionId: instA,
        code: 'EXT',
        name: 'Extramural',
        type: 'EXTRAMURAL',
        status: 'ACTIVE',
      },
    });
    entA1 = e1.id;
    entA2 = e2.id;

    const prog = await prisma.program.create({
      data: {
        institutionId: instA,
        entityId: entA1,
        name: 'CS',
        code: 'CS',
      },
    });

    const s1 = await prisma.student.create({
      data: {
        institutionId: instA,
        entityId: entA1,
        programId: prog.id,
        studentNumber: 'ISO-001',
      },
    });
    const s2 = await prisma.student.create({
      data: {
        institutionId: instA,
        entityId: entA2,
        programId: prog.id,
        studentNumber: 'ISO-002',
      },
    });
    studentA1 = s1.id;
    studentA2 = s2.id;
  }, 180_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  const entityActor = (entityId: string): AuthUser => ({
    userId: 'user-entity',
    email: 'registrar@test.edu',
    role: 'STAFF',
    institutionId: instA,
    entityId,
    entityScope: 'ENTITY',
    permissions: ['students.read'],
  });

  it('entity-scoped user can read student in own campus', async () => {
    const row = await students.getById(entityActor(entA1), studentA1);
    expect(row.id).toBe(studentA1);
  });

  it('entity-scoped user cannot read student in sibling campus (404)', async () => {
    await expect(students.getById(entityActor(entA1), studentA2)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('institution-wide actor can read any campus student', async () => {
    const allScope: AuthUser = {
      ...entityActor(entA1),
      entityScope: 'ALL',
    };
    const row = await students.getById(allScope, studentA2);
    expect(row.id).toBe(studentA2);
  });

  it('cross-institution access is forbidden at guard helper level', async () => {
    const { assertInstitutionAccess } = await import('../src/org-structure/org-structure.utils');
    await expect(
      assertInstitutionAccess(entityActor(entA1), 'other-institution'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
