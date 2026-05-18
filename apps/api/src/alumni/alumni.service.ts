import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { AlumniMentorshipService } from './alumni-mentorship.service';
import { AlumniRepository } from './alumni.repository';
import type { RegisterAlumniProfileDto } from './dto/register-alumni-profile.dto';
import type { UpdateAlumniProfileDto } from './dto/update-alumni-profile.dto';

@Injectable()
export class AlumniService {
  constructor(
    private readonly repo: AlumniRepository,
    private readonly mentorship: AlumniMentorshipService,
  ) {}

  listDirectory(user: AuthUser, entityId?: string) {
    return this.repo.listPublicProfiles(user.institutionId, entityId);
  }

  async registerFromStudent(user: AuthUser, dto: RegisterAlumniProfileDto) {
    const student = await this.repo.findStudentForAlumniLink(user.institutionId, dto.studentId);
    if (!student) throw new NotFoundException('Student not found');
    if (!student.graduationConfirmedAt) {
      throw new BadRequestException(
        'Alumni registration requires graduationConfirmedAt on the student record',
      );
    }
    if (!student.userId) {
      throw new BadRequestException('Student must be linked to a user account');
    }

    const profile = await this.repo.upsertProfile({
      institutionId: user.institutionId,
      entityId: student.entityId,
      userId: student.userId,
      studentId: student.id,
      programmeId: student.programId,
      graduationYear: dto.graduationYear,
      currentEmployer: dto.currentEmployer,
      jobTitle: dto.jobTitle,
      industry: dto.industry,
      bio: dto.bio,
      expertiseAreas: dto.expertiseAreas,
      mentorshipAvailable: dto.mentorshipAvailable ?? true,
    });

    await this.mentorship.syncMentorEmbedding(user.institutionId, profile.id);
    return profile;
  }

  async updateProfile(user: AuthUser, id: string, dto: UpdateAlumniProfileDto) {
    const existing = await this.repo.findProfileById(user.institutionId, id);
    if (!existing) throw new NotFoundException('Alumni profile not found');
    if (!existing.studentId) {
      throw new BadRequestException('Alumni profile is not linked to a student record');
    }
    const student = await this.repo.findStudentForAlumniLink(
      user.institutionId,
      existing.studentId,
    );
    if (!student) throw new NotFoundException('Linked student not found');

    const profile = await this.repo.upsertProfile({
      institutionId: user.institutionId,
      entityId: existing.entityId,
      userId: existing.userId,
      studentId: existing.studentId!,
      programmeId: existing.programmeId ?? student.programId,
      graduationYear: dto.graduationYear ?? existing.graduationYear ?? undefined,
      currentEmployer: dto.currentEmployer ?? existing.currentEmployer ?? undefined,
      jobTitle: dto.jobTitle ?? existing.jobTitle ?? undefined,
      industry: dto.industry ?? existing.industry ?? undefined,
      bio: dto.bio ?? existing.bio ?? undefined,
      expertiseAreas: dto.expertiseAreas ?? existing.expertiseAreas,
      mentorshipAvailable: dto.mentorshipAvailable ?? existing.mentorshipAvailable,
    });

    await this.mentorship.syncMentorEmbedding(user.institutionId, profile.id);
    return profile;
  }
}
