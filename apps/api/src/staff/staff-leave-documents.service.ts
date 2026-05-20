import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AuthUser } from '../auth/auth.types';
import { assertUploadMimeMatchesMagicBytes } from '../common/security/upload-magic-bytes.util';
import { ObjectStorageService } from '../storage/object-storage.service';
import { LeaveRepository } from '../leave/leave.repository';
import { StaffRepository } from './staff.repository';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

@Injectable()
export class StaffLeaveDocumentsService {
  constructor(
    private readonly repo: StaffRepository,
    private readonly leaveRepo: LeaveRepository,
    private readonly storage: ObjectStorageService,
  ) {}

  private async assertLeaveDocAccess(actor: AuthUser, staffId: string) {
    const profile = await this.repo.findProfile(actor.institutionId, staffId);
    if (!profile) throw new NotFoundException('Staff profile not found');
    if (profile.userId === actor.userId) return profile;
    if (
      !actor.permissions?.includes('*') &&
      !actor.permissions?.includes('staff.write') &&
      !actor.permissions?.includes('staff.read')
    ) {
      throw new ForbiddenException('Cannot upload leave documents for this staff member');
    }
    return profile;
  }

  async uploadSupportingDocument(
    actor: AuthUser,
    staffId: string,
    file: { buffer: Buffer; mimetype?: string; originalname?: string; size: number },
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('File is required');
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('File must be 5 MB or smaller');
    }
    const mime = assertUploadMimeMatchesMagicBytes(file.buffer, file.mimetype, ALLOWED_MIME);
    const profile = await this.assertLeaveDocAccess(actor, staffId);
    const safeName = (file.originalname || 'document').replace(/[^\w.\-]+/g, '_').slice(0, 120);
    const key = `hr/leave/${actor.institutionId}/${profile.entityId}/${staffId}/${randomUUID()}-${safeName}`;
    const stored = await this.storage.putBuffer(key, file.buffer, mime);
    return {
      supportingDocKey: stored.key,
      downloadUrl: await this.storage.resolveDownloadUrl(stored.key),
    };
  }

  async getSupportingDocumentUrl(actor: AuthUser, leaveRequestId: string) {
    const req = await this.leaveRepo.findLeaveRequest(actor.institutionId, leaveRequestId);
    if (!req) throw new NotFoundException('Leave request not found');
    if (
      req.staff.userId !== actor.userId &&
      !actor.permissions?.includes('*') &&
      !actor.permissions?.includes('staff.read') &&
      !actor.permissions?.includes('staff.write')
    ) {
      throw new ForbiddenException('Cannot access this leave request');
    }
    if (!req.supportingDocKey) {
      throw new NotFoundException('No supporting document on this request');
    }
    return {
      supportingDocKey: req.supportingDocKey,
      downloadUrl: await this.storage.resolveDownloadUrl(req.supportingDocKey),
    };
  }
}
