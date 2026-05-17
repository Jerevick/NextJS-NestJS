import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '../../auth/auth.types';
import { signAttendanceSessionToken } from '../../attendance/attendance-qr.util';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { STUDENT_RECORD_WRITE_KEY } from '../record-posting/student-record-write.meta';
import { StudentRecordPostingGuard } from './student-record-posting.guard';

function mockContext(req: {
  user?: AuthUser;
  body?: unknown;
  params?: Record<string, string>;
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

describe('StudentRecordPostingGuard', () => {
  const institutionId = 'inst-1';
  const actor: AuthUser = {
    userId: 'u1',
    email: 'a@a.com',
    role: 'FACULTY',
    institutionId,
    entityId: 'ent-1',
    entityScope: 'ENTITY',
    permissions: ['grades.write'],
  };

  const prisma = {
    student: { findFirst: jest.fn() },
    backfillWindow: { findFirst: jest.fn() },
    studentEnrollment: { findFirst: jest.fn() },
    gradeOverride: { findFirst: jest.fn() },
    attendance: { findFirst: jest.fn() },
  };

  let reflector: Reflector;
  let guard: StudentRecordPostingGuard;
  const config = {
    get: jest.fn((key: string) => (key === 'JWT_SECRET' ? 'jwt-secret-testing' : undefined)),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    reflector = new Reflector();
    guard = new StudentRecordPostingGuard(
      prisma as unknown as PrismaService,
      reflector,
      config as unknown as ConfigService,
    );
  });

  it('allows public routes without prisma calls', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((metadataKey: unknown) => {
      if (metadataKey === IS_PUBLIC_KEY) {
        return true;
      }
      return undefined;
    });
    const ok = await guard.canActivate(mockContext({}));
    expect(ok).toBe(true);
    expect(prisma.student.findFirst).not.toHaveBeenCalled();
  });

  it('allows ACTIVE student body writes', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((metadataKey: unknown) => {
      if (metadataKey === IS_PUBLIC_KEY) {
        return false;
      }
      if (metadataKey === STUDENT_RECORD_WRITE_KEY) {
        return {
          mode: 'bodyStudentId',
          studentIdField: 'studentId',
          recordDate: { kind: 'now' },
        };
      }
      return undefined;
    });
    prisma.student.findFirst.mockResolvedValue({ enrollmentStatus: 'ACTIVE', entityId: 'ent-1' });

    const ok = await guard.canActivate(
      mockContext({
        user: actor,
        body: { studentId: 'stu-1' },
        params: {},
      }),
    );
    expect(ok).toBe(true);
    expect(prisma.backfillWindow.findFirst).not.toHaveBeenCalled();
  });

  it('throws STUDENT_INACTIVE when not ACTIVE and no backfill window', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((metadataKey: unknown) => {
      if (metadataKey === IS_PUBLIC_KEY) {
        return false;
      }
      if (metadataKey === STUDENT_RECORD_WRITE_KEY) {
        return {
          mode: 'bodyStudentId',
          studentIdField: 'studentId',
          recordDate: { kind: 'now' },
        };
      }
      return undefined;
    });
    prisma.student.findFirst.mockResolvedValue({ enrollmentStatus: 'INACTIVE', entityId: 'ent-1' });
    prisma.backfillWindow.findFirst.mockResolvedValue(null);

    await expect(
      guard.canActivate(
        mockContext({
          user: actor,
          body: { studentId: 'stu-1' },
          params: {},
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows INACTIVE student when an active backfill window covers the record date', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((metadataKey: unknown) => {
      if (metadataKey === IS_PUBLIC_KEY) {
        return false;
      }
      if (metadataKey === STUDENT_RECORD_WRITE_KEY) {
        return {
          mode: 'bodyStudentId',
          studentIdField: 'studentId',
          recordDate: { kind: 'bodyField', field: 'sessionDate' },
        };
      }
      return undefined;
    });
    prisma.student.findFirst.mockResolvedValue({ enrollmentStatus: 'INACTIVE', entityId: 'ent-1' });
    prisma.backfillWindow.findFirst.mockResolvedValue({
      id: 'win-1',
      backfillRequestId: 'bfr-1',
    });

    const req: {
      user?: AuthUser;
      body?: unknown;
      params?: Record<string, string>;
      backfillContext?: unknown;
    } = {
      user: actor,
      body: { studentId: 'stu-1', sessionDate: '2024-01-15T00:00:00.000Z' },
      params: {},
    };
    const ok = await guard.canActivate(mockContext(req));
    expect(ok).toBe(true);
    expect(req.backfillContext).toEqual({
      isBackfilled: true,
      backfillRequestId: 'bfr-1',
      backfillWindowId: 'win-1',
    });
  });

  it('throws NotFound when enrollment id is unknown', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((metadataKey: unknown) => {
      if (metadataKey === IS_PUBLIC_KEY) {
        return false;
      }
      if (metadataKey === STUDENT_RECORD_WRITE_KEY) {
        return { mode: 'enrollmentIdParam', param: 'enrollmentId', recordDate: { kind: 'now' } };
      }
      return undefined;
    });
    prisma.studentEnrollment.findFirst.mockResolvedValue(null);

    await expect(
      guard.canActivate(
        mockContext({
          user: actor,
          body: {},
          params: { enrollmentId: 'missing' },
        }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows STUDENT self-scan when token matches institution and student is ACTIVE', async () => {
    const token = signAttendanceSessionToken('jwt-secret-testing', {
      institutionId,
      sectionId: 'sec-1',
      sessionDate: '2026-05-01',
    });
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((metadataKey: unknown) => {
      if (metadataKey === IS_PUBLIC_KEY) {
        return false;
      }
      if (metadataKey === STUDENT_RECORD_WRITE_KEY) {
        return { mode: 'attendanceSelfScanToken', tokenField: 'token' };
      }
      return undefined;
    });
    prisma.student.findFirst.mockResolvedValue({ enrollmentStatus: 'ACTIVE', entityId: 'ent-1' });
    const studentUser: AuthUser = {
      ...actor,
      role: 'STUDENT',
      studentId: 'stu-qr',
      permissions: [],
    };
    const ok = await guard.canActivate(
      mockContext({
        user: studentUser,
        body: { token },
        params: {},
      }),
    );
    expect(ok).toBe(true);
    expect(prisma.student.findFirst).toHaveBeenCalled();
  });
});
