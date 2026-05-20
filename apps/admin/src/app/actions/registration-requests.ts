'use server';

import { revalidatePath } from 'next/cache';
import { reviewRegistrationRequest } from '@/lib/platform-api';

export async function dismissRegistrationRequestAction(requestId: string) {
  const result = await reviewRegistrationRequest(requestId, 'DISMISSED');
  if (!result.ok) {
    return { error: 'message' in result ? result.message : 'Failed to dismiss request' };
  }
  revalidatePath('/registration-requests');
  revalidatePath('/dashboard');
  return { ok: true as const };
}

export async function markRegistrationRequestReviewedAction(requestId: string) {
  const result = await reviewRegistrationRequest(requestId, 'REVIEWED');
  if (!result.ok) {
    return { error: 'message' in result ? result.message : 'Failed to update request' };
  }
  revalidatePath('/registration-requests');
  revalidatePath('/dashboard');
  return { ok: true as const };
}
