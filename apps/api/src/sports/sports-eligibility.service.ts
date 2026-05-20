import { Injectable, Logger } from '@nestjs/common';
import { GpaRepeatPolicy } from '@prisma/client';
import { GpaComputationService } from '../progression/gpa-computation.service';
import { SportsRepository } from './sports.repository';
import { readSportsMinimumGpa } from './sports-settings.util';

export type EligibilityRecalcResult = {
  updated: number;
  ineligible: number;
};

export type AtRiskTeamAlert = {
  teamId: string;
  teamName: string;
  atRiskCount: number;
  players: Array<{ playerId: string; studentId: string; gpa: number | null }>;
};

@Injectable()
export class SportsEligibilityService {
  private readonly log = new Logger(SportsEligibilityService.name);

  constructor(
    private readonly repo: SportsRepository,
    private readonly gpaComputation: GpaComputationService,
  ) {}

  async recalculateForInstitution(institutionId: string): Promise<EligibilityRecalcResult> {
    const inst = await this.repo.getInstitutionSettings(institutionId);
    const minimumGpa = readSportsMinimumGpa(inst?.settings);
    const players = await this.repo.listActivePlayers(institutionId);
    let updated = 0;
    let ineligible = 0;

    for (const player of players) {
      const gpa = await this.studentGpa(institutionId, player.studentId, player.student.programId);
      const eligible = gpa !== null && gpa >= minimumGpa && player.medicalClearance;
      const reason = !player.medicalClearance
        ? 'Medical clearance required'
        : gpa === null
          ? 'GPA not available'
          : gpa < minimumGpa
            ? `GPA ${gpa.toFixed(2)} below minimum ${minimumGpa}`
            : null;

      await this.repo.updatePlayer(player.id, {
        isEligible: eligible,
        ineligibilityReason: reason,
      });
      updated++;
      if (!eligible) ineligible++;
    }

    this.log.log(
      `Recalculated sports eligibility for ${institutionId}: ${updated} players, ${ineligible} ineligible`,
    );
    return { updated, ineligible };
  }

  async recalculateForStudent(institutionId: string, studentId: string): Promise<void> {
    const inst = await this.repo.getInstitutionSettings(institutionId);
    const minimumGpa = readSportsMinimumGpa(inst?.settings);
    const players = await this.repo.listActivePlayers(institutionId);
    const mine = players.filter((p) => p.studentId === studentId);
    for (const player of mine) {
      const gpa = await this.studentGpa(institutionId, studentId, player.student.programId);
      const eligible = gpa !== null && gpa >= minimumGpa && player.medicalClearance;
      const reason = !player.medicalClearance
        ? 'Medical clearance required'
        : gpa === null
          ? 'GPA not available'
          : gpa < minimumGpa
            ? `GPA ${gpa.toFixed(2)} below minimum ${minimumGpa}`
            : null;
      await this.repo.updatePlayer(player.id, {
        isEligible: eligible,
        ineligibilityReason: reason,
      });
    }
  }

  async atRiskAlerts(institutionId: string, buffer = 0.3): Promise<AtRiskTeamAlert[]> {
    const inst = await this.repo.getInstitutionSettings(institutionId);
    const minimumGpa = readSportsMinimumGpa(inst?.settings);
    const threshold = minimumGpa + buffer;
    const players = await this.repo.listActivePlayers(institutionId);
    const byTeam = new Map<string, AtRiskTeamAlert>();

    for (const player of players) {
      const gpa = await this.studentGpa(institutionId, player.studentId, player.student.programId);
      if (gpa === null || gpa >= threshold) continue;
      const key = player.teamId;
      const existing = byTeam.get(key) ?? {
        teamId: key,
        teamName: player.team.name,
        atRiskCount: 0,
        players: [],
      };
      existing.atRiskCount++;
      existing.players.push({ playerId: player.id, studentId: player.studentId, gpa });
      byTeam.set(key, existing);
    }

    return [...byTeam.values()].filter((t) => t.atRiskCount > 0);
  }

  private async studentGpa(
    institutionId: string,
    studentId: string,
    programId: string,
  ): Promise<number | null> {
    const st = await this.repo.studentEnrollmentsForGpa(institutionId, studentId);
    if (!st) return null;
    const rule = await this.repo.progressionRuleGpaPolicy(institutionId, programId);
    const policy = rule?.gpaRepeatPolicy ?? GpaRepeatPolicy.BEST_OF_ATTEMPTS;
    const rows = this.gpaComputation.rowsFromEnrollments(st.enrollments);
    return this.gpaComputation.summarizeWithPolicy(rows, policy).cumulativeGpa;
  }
}
