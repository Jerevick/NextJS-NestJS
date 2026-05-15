import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { LmsRepository } from './lms.repository';
import { LmsService } from './lms.service';

describe('LmsService', () => {
  let lms: LmsService;
  let repo: Partial<Record<keyof LmsRepository, jest.Mock>>;

  const actor = {
    userId: 'u1',
    email: 't@t.com',
    role: 'FACULTY' as const,
    institutionId: 'i1',
    entityId: 'ent-1',
    entityScope: 'ENTITY' as const,
    permissions: ['lms.write'],
  } as AuthUser;

  beforeEach(async () => {
    repo = {
      findSectionInInstitution: jest.fn(),
      cloneCourseInstance: jest.fn(),
      reorderModules: jest.fn(),
      findCourseInstanceById: jest.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        LmsService,
        { provide: LmsRepository, useValue: repo },
        { provide: AuditService, useValue: { append: jest.fn() } },
      ],
    }).compile();
    lms = moduleRef.get(LmsService);
  });

  describe('cloneCourseInstance', () => {
    it('throws when target section is missing', async () => {
      repo.findCourseInstanceById!.mockResolvedValueOnce({ id: 'src1' } as never);
      repo.findSectionInInstitution!.mockResolvedValue(null);
      await expect(lms.cloneCourseInstance(actor, 'src1', { targetSectionId: 'missing' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.cloneCourseInstance).not.toHaveBeenCalled();
    });

    it('throws Conflict when target already has an instance', async () => {
      repo.findCourseInstanceById!.mockResolvedValueOnce({ id: 'src1' } as never);
      repo.findSectionInInstitution!.mockResolvedValue({ id: 'sec2' });
      repo.cloneCourseInstance!.mockResolvedValue({ ok: false, code: 'target_has_instance' });
      await expect(lms.cloneCourseInstance(actor, 'src1', { targetSectionId: 'sec2' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('returns full course when clone succeeds', async () => {
      const detail = {
        id: 'new1',
        sectionId: 'sec2',
        institutionId: 'i1',
        isPublished: false,
        coverImage: null,
        welcomeMessage: null,
        settings: {},
        section: {
          course: { id: 'c1', code: 'CS101', title: 'Intro' },
          semester: { id: 'sem1', name: 'Fall' },
        },
        modules: [],
      };
      repo.findCourseInstanceById!
        .mockResolvedValueOnce({ id: 'src1' } as never)
        .mockResolvedValueOnce(detail as never);
      repo.findSectionInInstitution!.mockResolvedValue({ id: 'sec2' });
      repo.cloneCourseInstance!.mockResolvedValue({ ok: true, courseInstanceId: 'new1' });
      const out = await lms.cloneCourseInstance(actor, 'src1', { targetSectionId: 'sec2' });
      expect(out.id).toBe('new1');
      expect(out.modules).toEqual([]);
    });
  });

  describe('reorderModules', () => {
    it('throws BadRequest when ids do not match all modules', async () => {
      repo.findCourseInstanceById!.mockResolvedValue({ id: 'ci1' } as never);
      repo.reorderModules!.mockResolvedValue({ ok: false, reason: 'count_mismatch' });
      await expect(lms.reorderModules(actor, 'ci1', { moduleIds: ['a'] })).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
