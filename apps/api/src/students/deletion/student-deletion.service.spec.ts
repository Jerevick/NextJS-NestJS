import { BadRequestException } from '@nestjs/common';
import { StudentEnrollmentStatusEnum } from '@prisma/client';
import { StudentDeletionService } from './student-deletion.service';

describe('StudentDeletionService', () => {
  const prisma = {
    student: { findFirst: jest.fn() },
    workflowInstance: { count: jest.fn() },
    $transaction: jest.fn(),
  };
  const audit = { append: jest.fn() };
  const statusChanges = { changeEnrollmentStatus: jest.fn() };

  let service: StudentDeletionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StudentDeletionService(prisma as never, audit as never, statusChanges as never);
  });

  it('rejects ACTIVE students', async () => {
    prisma.student.findFirst.mockResolvedValue({
      id: 's1',
      entityId: 'e1',
      studentNumber: 'STU001',
      enrollmentStatus: StudentEnrollmentStatusEnum.ACTIVE,
      userId: 'u1',
      user: { id: 'u1', email: 'a@b.com' },
    });

    await expect(
      service.execute({
        institutionId: 'i1',
        studentId: 's1',
        actorUserId: 'admin',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('is idempotent when already PERMANENTLY_DELETED', async () => {
    prisma.student.findFirst.mockResolvedValue({
      id: 's1',
      entityId: 'e1',
      studentNumber: 'STU001',
      enrollmentStatus: StudentEnrollmentStatusEnum.PERMANENTLY_DELETED,
      userId: null,
      user: null,
    });

    const result = await service.execute({
      institutionId: 'i1',
      studentId: 's1',
      actorUserId: 'admin',
    });
    expect(result.studentNumber).toBe('STU001');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
