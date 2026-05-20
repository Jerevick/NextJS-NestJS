import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MentorshipStatus, Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { TenantModulesService } from '../common/tenant-modules/tenant-modules.service';
import { TenantModule } from '@prisma/client';

@Injectable()
export class AlumniMentorshipProgramService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantModules: TenantModulesService,
  ) {}

  private async assertAlumni(institutionId: string) {
    await this.tenantModules.assertEnabled(institutionId, TenantModule.ALUMNI);
  }

  async listPrograms(user: AuthUser, entityId?: string) {
    await this.assertAlumni(user.institutionId);
    return this.prisma.mentorshipProgram.findMany({
      where: {
        institutionId: user.institutionId,
        ...(entityId ? { entityId } : {}),
      },
      include: { _count: { select: { pairs: true } } },
      orderBy: { startDate: 'desc' },
    });
  }

  async createProgram(
    user: AuthUser,
    body: {
      name: string;
      entityId: string;
      description?: string;
      startDate: string;
      endDate?: string;
    },
  ) {
    await this.assertAlumni(user.institutionId);
    return this.prisma.mentorshipProgram.create({
      data: {
        institutionId: user.institutionId,
        entityId: body.entityId,
        name: body.name,
        description: body.description,
        startDate: new Date(body.startDate),
        endDate: body.endDate ? new Date(body.endDate) : undefined,
      },
    });
  }

  async createPair(
    user: AuthUser,
    body: {
      programId: string;
      mentorUserId: string;
      menteeStudentId: string;
      goals?: Record<string, unknown>;
    },
  ) {
    await this.assertAlumni(user.institutionId);
    const program = await this.prisma.mentorshipProgram.findFirst({
      where: { id: body.programId, institutionId: user.institutionId },
    });
    if (!program) throw new NotFoundException('Mentorship program not found');

    return this.prisma.mentorshipPair.create({
      data: {
        institutionId: user.institutionId,
        entityId: program.entityId,
        programId: body.programId,
        mentorUserId: body.mentorUserId,
        menteeStudentId: body.menteeStudentId,
        goals: (body.goals ?? {}) as Prisma.InputJsonValue,
        status: MentorshipStatus.PENDING,
      },
    });
  }

  async updatePairStatus(
    user: AuthUser,
    pairId: string,
    status: MentorshipStatus,
    body?: { rating?: number; feedback?: string; sessionCount?: number },
  ) {
    await this.assertAlumni(user.institutionId);
    const pair = await this.prisma.mentorshipPair.findFirst({
      where: { id: pairId, institutionId: user.institutionId },
    });
    if (!pair) throw new NotFoundException('Mentorship pair not found');
    if (!Object.values(MentorshipStatus).includes(status)) {
      throw new BadRequestException('Invalid mentorship status');
    }
    return this.prisma.mentorshipPair.update({
      where: { id: pairId },
      data: {
        status,
        rating: body?.rating,
        feedback: body?.feedback,
        sessionCount: body?.sessionCount,
      },
    });
  }

  async listPairs(user: AuthUser, programId?: string) {
    await this.assertAlumni(user.institutionId);
    return this.prisma.mentorshipPair.findMany({
      where: {
        institutionId: user.institutionId,
        ...(programId ? { programId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
