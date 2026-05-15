import { randomBytes, randomUUID } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { EnrollmentRowStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import type { GenerateTranscriptDto } from './dto/generate-transcript.dto';
import type { ListTranscriptsQueryDto } from './dto/list-transcripts-query.dto';
import { TranscriptsRepository } from './transcripts.repository';

function readProfileName(profile: unknown): { firstName?: string; lastName?: string } {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    return {};
  }
  const p = profile as Record<string, unknown>;
  const firstName = typeof p.firstName === 'string' ? p.firstName : undefined;
  const lastName = typeof p.lastName === 'string' ? p.lastName : undefined;
  return { firstName, lastName };
}

function readGradeJson(grade: unknown): {
  score?: number;
  letterGrade?: string;
  gradePoints?: number;
  workflowStatus?: string;
} {
  if (!grade || typeof grade !== 'object' || Array.isArray(grade)) {
    return {};
  }
  const g = grade as Record<string, unknown>;
  const score = typeof g.score === 'number' && !Number.isNaN(g.score) ? g.score : undefined;
  const letterGrade = typeof g.letterGrade === 'string' ? g.letterGrade : undefined;
  const gradePoints =
    typeof g.gradePoints === 'number' && !Number.isNaN(g.gradePoints) ? g.gradePoints : undefined;
  const workflowStatus = typeof g.workflowStatus === 'string' ? g.workflowStatus : undefined;
  return { score, letterGrade, gradePoints, workflowStatus };
}

function countsTowardGpa(status: EnrollmentRowStatus): boolean {
  return status === 'COMPLETED' || status === 'FAILED' || status === 'ENROLLED';
}

@Injectable()
export class TranscriptsService {
  constructor(
    private readonly repo: TranscriptsRepository,
    private readonly audit: AuditService,
  ) {}

  async generate(actor: AuthUser, dto: GenerateTranscriptDto) {
    const student = await this.repo.findStudentHeader(actor.institutionId, dto.studentId);
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const enrollments = await this.repo.findEnrollmentsForTranscript(actor.institutionId, dto.studentId);
    const lines = enrollments.map((e) => {
      const g = readGradeJson(e.grade);
      return {
        enrollmentId: e.id,
        status: e.status,
        enrolledAt: e.enrolledAt.toISOString(),
        semester: {
          id: e.semester.id,
          name: e.semester.name,
          startDate: e.semester.startDate.toISOString(),
          endDate: e.semester.endDate.toISOString(),
        },
        course: {
          code: e.section.course.code,
          title: e.section.course.title,
          creditHours: e.section.course.creditHours,
        },
        grade: {
          score: g.score ?? null,
          letterGrade: g.letterGrade ?? null,
          gradePoints: g.gradePoints ?? null,
          workflowStatus: g.workflowStatus ?? null,
        },
      };
    });

    let qualityPoints = 0;
    let gpaCredits = 0;
    for (const e of enrollments) {
      if (!countsTowardGpa(e.status)) {
        continue;
      }
      const g = readGradeJson(e.grade);
      if (g.gradePoints === undefined || e.status === 'ENROLLED') {
        continue;
      }
      const credits = e.section.course.creditHours;
      if (credits > 0) {
        qualityPoints += g.gradePoints * credits;
        gpaCredits += credits;
      }
    }

    if (!student.user) {
      throw new BadRequestException('Student account is not available for transcript generation');
    }
    const name = readProfileName(student.user.profile);
    const content = {
      version: 1 as const,
      student: {
        id: student.id,
        studentNumber: student.studentNumber,
        name,
        email: student.user.email,
        program: student.program,
        admissionDate: student.admissionDate?.toISOString() ?? null,
        expectedGraduationDate: student.expectedGraduationDate?.toISOString() ?? null,
      },
      lines,
      summary: {
        cumulativeGpa: gpaCredits > 0 ? Math.round((qualityPoints / gpaCredits) * 1000) / 1000 : null,
        gpaCreditHours: gpaCredits,
        lineCount: lines.length,
      },
    };

    const id = randomUUID();
    const generatedAt = new Date();
    const isOfficial = dto.isOfficial === true;
    const verificationHash = randomBytes(32).toString('hex');
    const verificationUrl = `/transcripts/verify/${verificationHash}`;

    const created = await this.repo.createTranscript({
      id,
      institutionId: actor.institutionId,
      studentId: dto.studentId,
      isOfficial,
      content: content as unknown as Prisma.InputJsonValue,
      verificationHash,
      verificationUrl,
      generatedAt,
    });

    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'transcript.generate',
      entity: 'Transcript',
      entityId: created.id,
      newValues: { studentId: dto.studentId, isOfficial, lineCount: lines.length },
    });

    return this.serializeDetail(created);
  }

  async list(actor: AuthUser, query: ListTranscriptsQueryDto) {
    const student = await this.repo.findStudentHeader(actor.institutionId, query.studentId);
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const limit = query.limit ?? 20;
    const rows = await this.repo.listForStudent(actor.institutionId, query.studentId, limit, query.cursor);
    let nextCursor: string | undefined;
    if (rows.length > limit) {
      const last = rows.pop();
      nextCursor = last?.id;
    }
    const total = await this.repo.countForStudent(actor.institutionId, query.studentId);
    return { data: rows, nextCursor, total };
  }

  async getById(actor: AuthUser, id: string) {
    const row = await this.repo.findById(actor.institutionId, id);
    if (!row) {
      throw new NotFoundException('Transcript not found');
    }
    return this.serializeDetail(row);
  }

  async verifyByHash(verificationHash: string) {
    if (!verificationHash || verificationHash.length < 16) {
      throw new BadRequestException('Invalid verification reference');
    }
    const row = await this.repo.findByVerificationHash(verificationHash);
    if (!row) {
      return { valid: false as const };
    }
    return {
      valid: true as const,
      generatedAt: row.generatedAt.toISOString(),
      isOfficial: row.isOfficial,
      studentNumber: row.student?.studentNumber ?? null,
    };
  }

  private serializeDetail(
    row: NonNullable<Awaited<ReturnType<TranscriptsRepository['findById']>>> & {
      student?: {
        id: string;
        studentNumber: string;
        user: { email: string; profile: unknown } | null;
        program: { id: string; name: string; code: string };
      };
    },
  ) {
    return {
      id: row.id,
      studentId: row.studentId,
      generatedAt: row.generatedAt,
      isOfficial: row.isOfficial,
      verificationUrl: row.verificationUrl,
      verificationHash: row.verificationHash,
      content: row.content,
      student: row.student,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
