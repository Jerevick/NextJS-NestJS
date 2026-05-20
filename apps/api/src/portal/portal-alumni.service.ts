import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { AlumniRepository } from '../alumni/alumni.repository';
import { AlumniService } from '../alumni/alumni.service';
import type { UpdateAlumniProfileDto } from '../alumni/dto/update-alumni-profile.dto';

function displayName(profile: unknown, email: string): string {
  if (profile && typeof profile === 'object') {
    const p = profile as Record<string, unknown>;
    const first = typeof p.firstName === 'string' ? p.firstName : '';
    const last = typeof p.lastName === 'string' ? p.lastName : '';
    const name = [first, last].filter(Boolean).join(' ').trim();
    if (name) {
      return name;
    }
  }
  return email;
}

@Injectable()
export class PortalAlumniService {
  constructor(
    private readonly alumni: AlumniService,
    private readonly repo: AlumniRepository,
  ) {}

  private assertAlumniRole(user: AuthUser) {
    if (user.role !== 'ALUMNI') {
      throw new ForbiddenException('Alumni portal access only');
    }
  }

  private async campusEntityId(user: AuthUser): Promise<string | undefined> {
    const profile = await this.repo.findProfileByUserId(user.institutionId, user.userId);
    return profile?.entityId ?? user.entityId;
  }

  async getProfile(user: AuthUser) {
    this.assertAlumniRole(user);
    const [profile, userBrief, student] = await Promise.all([
      this.repo.findProfileDetailByUserId(user.institutionId, user.userId),
      this.repo.findUserBrief(user.userId),
      this.repo.findStudentByUserId(user.institutionId, user.userId),
    ]);

    const dn = displayName(userBrief?.profile, userBrief?.email ?? user.email);

    if (!profile) {
      return {
        hasProfile: false,
        displayName: dn,
        canRegister: Boolean(student?.graduationConfirmedAt),
        profile: null,
      };
    }

    return {
      hasProfile: true,
      displayName: dn,
      canRegister: true,
      profile: {
        id: profile.id,
        graduationYear: profile.graduationYear,
        currentEmployer: profile.currentEmployer,
        jobTitle: profile.jobTitle,
        industry: profile.industry,
        bio: profile.bio,
        expertiseAreas: profile.expertiseAreas,
        mentorshipAvailable: profile.mentorshipAvailable,
        isVerified: profile.isVerified,
        programme: profile.programme,
        entity: profile.entity,
      },
    };
  }

  async saveProfile(user: AuthUser, dto: UpdateAlumniProfileDto) {
    this.assertAlumniRole(user);
    return this.alumni.saveSelfProfile(user, dto);
  }

  async listEvents(user: AuthUser) {
    this.assertAlumniRole(user);
    const entityId = await this.campusEntityId(user);
    const rows = await this.repo.listEventsForCampus(user.institutionId, entityId);
    const registrations = await this.repo.listUserEventRegistrations(
      user.userId,
      rows.map((e) => e.id),
    );
    const regByEvent = new Map(registrations.map((r) => [r.eventId, r]));

    return rows.map((e) => {
      const mine = regByEvent.get(e.id);
      return {
        id: e.id,
        title: e.title,
        description: e.description,
        type: e.type,
        startAt: e.startDate.toISOString(),
        endAt: e.endDate?.toISOString() ?? null,
        location: e.location,
        isVirtual: e.isVirtual,
        fee: Number(e.fee),
        capacity: e.capacity,
        registrationDeadline: e.registrationDeadline?.toISOString() ?? null,
        registrationCount: e._count.registrations,
        myRegistration: mine
          ? {
              paymentStatus: mine.paymentStatus,
              paymentUrl: mine.paymentUrl,
            }
          : null,
      };
    });
  }

  async listJobs(user: AuthUser) {
    this.assertAlumniRole(user);
    const rows = await this.alumni.listJobs(user);
    return rows.map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company,
      description: j.description,
      requirements: j.requirements,
      salary: j.salary,
      location: j.location,
      type: j.type,
      deadline: j.deadline?.toISOString() ?? null,
      createdAt: j.createdAt.toISOString(),
    }));
  }

  async registerForEvent(
    user: AuthUser,
    eventId: string,
    body?: { paymentRef?: string; successUrl?: string; cancelUrl?: string },
  ) {
    this.assertAlumniRole(user);
    const base = process.env.WEB_APP_URL ?? 'http://localhost:3000';
    return this.alumni.registerForEvent(user, eventId, {
      ...body,
      successUrl: body?.successUrl ?? `${base}/alumni/events?registered=1`,
      cancelUrl: body?.cancelUrl ?? `${base}/alumni/events`,
    });
  }
}
