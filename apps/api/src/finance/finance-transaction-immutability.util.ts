import { BadRequestException } from '@nestjs/common';
import type { FinanceTransactionStatus, Prisma } from '@prisma/client';

const IMMUTABLE_WHEN_SETTLED = [
  'amount',
  'type',
  'studentAccountId',
  'entityId',
  'institutionId',
  'currency',
  'reference',
  'description',
] as const satisfies ReadonlyArray<keyof Prisma.FinanceTransactionUncheckedUpdateInput>;

/**
 * Completed / failed / cancelled rows are append-only for monetary fields.
 * Only lifecycle metadata (status, gatewayResponse, metadata, processed*) may change.
 */
export function assertFinanceTransactionUpdateAllowed(
  current: { status: FinanceTransactionStatus },
  data: Prisma.FinanceTransactionUpdateInput,
): void {
  if (current.status === 'PENDING') {
    return;
  }
  const patch = data as Prisma.FinanceTransactionUncheckedUpdateInput;
  for (const field of IMMUTABLE_WHEN_SETTLED) {
    if (patch[field] !== undefined) {
      throw new BadRequestException(
        `Cannot modify transaction field "${String(field)}" when status is ${current.status}`,
      );
    }
  }
}

export function pickGatewayOnlyUpdate(
  data: Prisma.FinanceTransactionUpdateInput,
): Prisma.FinanceTransactionUpdateInput {
  const out: Prisma.FinanceTransactionUpdateInput = {};
  if (data.gatewayResponse !== undefined) {
    out.gatewayResponse = data.gatewayResponse;
  }
  if (data.metadata !== undefined) {
    out.metadata = data.metadata;
  }
  if (data.processedAt !== undefined) {
    out.processedAt = data.processedAt;
  }
  if (data.processedBy !== undefined) {
    out.processedBy = data.processedBy;
  }
  if (data.status !== undefined) {
    out.status = data.status;
  }
  if (data.approvalWorkflowId !== undefined) {
    out.approvalWorkflowId = data.approvalWorkflowId;
  }
  return out;
}
