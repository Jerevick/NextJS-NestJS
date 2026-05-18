import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { EmbeddingsService } from '../ai/embeddings.service';
import { AiService } from '../ai/ai.service';
import { buildAnonymizedAliasMap, scrubMessagesForExternalAi } from '../ai/ai-pii.util';
import { AlumniRepository } from './alumni.repository';

const MENTOR_SOURCE = 'alumni_mentor';
const MENTEE_SOURCE = 'student_mentee';

@Injectable()
export class AlumniMentorshipService {
  constructor(
    private readonly repo: AlumniRepository,
    private readonly embeddings: EmbeddingsService,
    private readonly ai: AiService,
  ) {}

  async syncMentorEmbedding(institutionId: string, profileId: string) {
    const profile = await this.repo.findProfileById(institutionId, profileId);
    if (!profile) throw new NotFoundException('Alumni profile not found');
    const content = this.mentorEmbeddingText(profile);
    await this.embeddings.upsertDocument({
      institutionId,
      entityId: profile.entityId,
      sourceType: MENTOR_SOURCE,
      sourceId: profile.id,
      content,
      metadata: {
        mentorshipAvailable: profile.mentorshipAvailable,
        industry: profile.industry,
        expertiseAreas: profile.expertiseAreas,
      },
    });
    return { profileId, synced: true };
  }

  async suggestMatches(
    user: AuthUser,
    studentId: string,
    opts?: { topK?: number; includeNarrative?: boolean },
  ) {
    const student = await this.repo.findStudentForMentorship(user.institutionId, studentId);
    if (!student) throw new NotFoundException('Student not found');

    const careerGoals =
      student.careerGoals?.trim() ||
      ((student.user?.profile ?? {}) as { careerGoals?: string }).careerGoals?.trim() ||
      'General career development';

    const menteeText = [
      `Programme: ${student.program.name} (${student.program.code})`,
      `Career goals: ${careerGoals}`,
      `Level: ${student.currentLevel}`,
    ].join('\n');

    await this.embeddings.upsertDocument({
      institutionId: user.institutionId,
      entityId: student.entityId,
      sourceType: MENTEE_SOURCE,
      sourceId: student.id,
      content: menteeText,
    });

    const search = await this.embeddings.similaritySearch({
      institutionId: user.institutionId,
      entityId: student.entityId,
      query: menteeText,
      topK: opts?.topK ?? 8,
      sourceTypes: [MENTOR_SOURCE],
    });

    const profileIds = search.data.map((r) => r.sourceId);
    const profiles = await this.repo.findProfilesByIds(user.institutionId, profileIds);
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    const matches = search.data
      .map((row, index) => {
        const profile = profileMap.get(row.sourceId);
        if (!profile?.mentorshipAvailable || profile.deletedAt) return null;
        return {
          rank: index + 1,
          alumniProfileId: profile.id,
          score: Math.round((row.score ?? 0) * 1000) / 1000,
          industry: profile.industry,
          jobTitle: profile.jobTitle,
          expertiseAreas: profile.expertiseAreas,
          graduationYear: profile.graduationYear,
          mentorLabel: `Mentor ${String.fromCharCode(65 + index)}`,
          isAIGenerated: true,
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);

    let narrative: string | undefined;
    if (opts?.includeNarrative && matches.length > 0) {
      const aliasMap = buildAnonymizedAliasMap(
        profiles.flatMap((p) => {
          const prof = p.user.profile as { firstName?: string; lastName?: string };
          const name = [prof.firstName, prof.lastName].filter(Boolean).join(' ');
          return name ? [name] : [];
        }),
      );
      const messages = scrubMessagesForExternalAi(
        [
          {
            role: 'system',
            content:
              'Summarise mentorship match results for academic staff. Use only anonymised mentor labels. Do not invent employers.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              studentProgramme: student.program.code,
              careerGoals,
              matches: matches.map((m) => ({
                label: m.mentorLabel,
                score: m.score,
                industry: m.industry,
                expertise: m.expertiseAreas,
              })),
            }),
          },
        ],
        aliasMap,
      );
      narrative = await this.ai.complete(user.institutionId, messages);
    }

    return {
      studentId,
      programme: { code: student.program.code, name: student.program.name },
      careerGoals,
      matches,
      narrative,
      isAIGenerated: true,
    };
  }

  private mentorEmbeddingText(profile: {
    industry: string | null;
    jobTitle: string | null;
    currentEmployer: string | null;
    bio: string | null;
    expertiseAreas: string[];
  }): string {
    return [
      profile.industry ? `Industry: ${profile.industry}` : '',
      profile.jobTitle ? `Role: ${profile.jobTitle}` : '',
      profile.currentEmployer ? `Employer: ${profile.currentEmployer}` : '',
      profile.expertiseAreas.length ? `Expertise: ${profile.expertiseAreas.join(', ')}` : '',
      profile.bio ? `Bio: ${profile.bio}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }
}
