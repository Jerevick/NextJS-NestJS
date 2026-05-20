'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { apiBase, buildApiHeaders } from '@/lib/server-api';

export type BrandingInput = {
  logoUrl?: string;
  primaryColor?: string;
  customDomain?: string;
  entityId?: string;
};

export async function saveBranding(
  input: BrandingInput,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };

  const qs = input.entityId ? `?entityId=${encodeURIComponent(input.entityId)}` : '';
  const res = await fetch(`${apiBase}/customization/branding${qs}`, {
    method: 'PATCH',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      logoUrl: input.logoUrl,
      primaryColor: input.primaryColor,
      customDomain: input.customDomain,
    }),
    cache: 'no-store',
  });

  if (!res.ok) return { error: `Save failed (${res.status}): ${await res.text()}` };
  revalidatePath('/settings/branding');
  return { ok: true };
}

export async function uploadBrandingLogo(
  formData: FormData,
  entityId?: string,
): Promise<{ error?: string; logoUrl?: string }> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose an image file to upload.' };
  }

  const body = new FormData();
  body.append('file', file);
  const qs = entityId ? `?entityId=${encodeURIComponent(entityId)}` : '';
  const headers = buildApiHeaders(session);

  const res = await fetch(`${apiBase}/customization/branding/logo${qs}`, {
    method: 'POST',
    headers,
    body,
    cache: 'no-store',
  });

  if (!res.ok) return { error: `Upload failed (${res.status}): ${await res.text()}` };
  const data = (await res.json()) as { logoUrl?: string };
  revalidatePath('/settings/branding');
  return { logoUrl: data.logoUrl };
}
