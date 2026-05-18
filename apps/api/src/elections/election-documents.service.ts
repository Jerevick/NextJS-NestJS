import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AuthUser } from '../auth/auth.types';
import { ObjectStorageService } from '../storage/object-storage.service';
import { ElectionsRepository } from './elections.repository';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

@Injectable()
export class ElectionDocumentsService {
  constructor(
    private readonly repo: ElectionsRepository,
    private readonly storage: ObjectStorageService,
  ) {}

  async uploadManifesto(
    actor: AuthUser,
    electionId: string,
    file: { buffer: Buffer; mimetype?: string; originalname?: string; size: number },
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('File is required');
    if (file.size > MAX_BYTES) throw new BadRequestException('File must be 5 MB or smaller');
    const mime = file.mimetype?.toLowerCase() ?? '';
    if (!ALLOWED_MIME.has(mime)) {
      throw new BadRequestException('Allowed types: PDF, JPEG, PNG, WebP');
    }
    const election = await this.repo.findElection(actor.institutionId, electionId);
    if (!election) throw new NotFoundException('Election not found');
    const safeName = (file.originalname || 'manifesto').replace(/[^\w.\-]+/g, '_').slice(0, 120);
    const key = `elections/manifestos/${actor.institutionId}/${election.entityId}/${electionId}/${randomUUID()}-${safeName}`;
    const stored = await this.storage.putBuffer(key, file.buffer, mime);
    return {
      manifestoDocKey: stored.key,
      downloadUrl: this.storage.getDownloadUrl(stored.key),
    };
  }

  async uploadCandidatePhoto(
    actor: AuthUser,
    candidateId: string,
    file: { buffer: Buffer; mimetype?: string; originalname?: string; size: number },
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('File is required');
    if (file.size > 2 * 1024 * 1024) throw new BadRequestException('Photo must be 2 MB or smaller');
    const mime = file.mimetype?.toLowerCase() ?? '';
    if (!mime.startsWith('image/')) {
      throw new BadRequestException('Photo must be an image (JPEG, PNG, or WebP)');
    }
    const candidate = await this.repo.findCandidateById(candidateId);
    if (!candidate || candidate.institutionId !== actor.institutionId) {
      throw new NotFoundException('Candidate not found');
    }
    const safeName = (file.originalname || 'photo').replace(/[^\w.\-]+/g, '_').slice(0, 80);
    const key = `elections/photos/${actor.institutionId}/${candidate.electionId}/${candidateId}/${randomUUID()}-${safeName}`;
    const stored = await this.storage.putBuffer(key, file.buffer, mime);
    await this.repo.updateCandidate(candidateId, { photo: stored.key });
    return {
      photoKey: stored.key,
      downloadUrl: this.storage.getDownloadUrl(stored.key),
    };
  }

  getPhotoUrl(photoKey: string | null | undefined) {
    if (!photoKey) return null;
    return this.storage.getDownloadUrl(photoKey);
  }

  async getManifestoUrl(actor: AuthUser, candidateId: string) {
    const candidate = await this.repo.findCandidateById(candidateId);
    if (!candidate || candidate.institutionId !== actor.institutionId) {
      throw new NotFoundException('Candidate not found');
    }
    if (!candidate.manifestoDocKey) throw new NotFoundException('No manifesto uploaded');
    return { downloadUrl: this.storage.getDownloadUrl(candidate.manifestoDocKey) };
  }
}
