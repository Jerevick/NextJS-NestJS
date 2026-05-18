import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AlumniRepository {
  constructor(private readonly prisma: PrismaService) {}

  findProfileById(institutionId: string, id: string) {
    return this.prisma.alumniProfile.findFirst({
      where: { id, institutionId, deletedAt: null },
      include: { user: { select: { profile: true } } },
    });
  }

  findProfilesByIds(institutionId: string, ids: string[]) {
    if (!ids.length) return Promise.resolve([]);
    return this.prisma.alumniProfile.findMany({
      where: { institutionId, id: { in: ids }, deletedAt: null },
      include: { user: { select: { profile: true } } },
    });
  }

  findStudentForMentorship(institutionId: string, studentId: string) {
    return this.prisma.student.findFirst({
      where: { id: studentId, institutionId, deletedAt: null },
      include: {
        program: { select: { id: true, name: true, code: true, departmentId: true } },
        user: { select: { profile: true } },
      },
    });
  }

  findStudentForAlumniLink(institutionId: string, studentId: string) {
    return this.prisma.student.findFirst({
      where: { id: studentId, institutionId, deletedAt: null },
      select: {
        id: true,
        userId: true,
        entityId: true,
        programId: true,
        graduationConfirmedAt: true,
      },
    });
  }

  upsertProfile(data: {
    institutionId: string;
    entityId: string;
    userId: string;
    studentId: string;
    programmeId: string;
    graduationYear?: number;
    currentEmployer?: string;
    jobTitle?: string;
    industry?: string;
    bio?: string;
    expertiseAreas?: string[];
    mentorshipAvailable?: boolean;
  }) {
    return this.prisma.alumniProfile.upsert({
      where: { userId: data.userId },
      create: data,
      update: {
        entityId: data.entityId,
        studentId: data.studentId,
        programmeId: data.programmeId,
        graduationYear: data.graduationYear,
        currentEmployer: data.currentEmployer,
        jobTitle: data.jobTitle,
        industry: data.industry,
        bio: data.bio,
        expertiseAreas: data.expertiseAreas ?? [],
        mentorshipAvailable: data.mentorshipAvailable ?? true,
        deletedAt: null,
      },
    });
  }

  listPublicProfiles(institutionId: string, entityId?: string) {
    return this.prisma.alumniProfile.findMany({
      where: {
        institutionId,
        deletedAt: null,
        isPublic: true,
        ...(entityId ? { entityId } : {}),
      },
      orderBy: { graduationYear: 'desc' },
      take: 100,
      select: {
        id: true,
        graduationYear: true,
        industry: true,
        jobTitle: true,
        expertiseAreas: true,
        mentorshipAvailable: true,
        chapters: true,
      },
    });
  }
}
