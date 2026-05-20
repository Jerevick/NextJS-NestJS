export type InstitutionBranding = {
  name?: string;
  logoUrl?: string;
  primaryColor?: string;
};

export function readInstitutionBranding(
  institutionName: string,
  settings: unknown,
  entitySettings?: unknown,
): InstitutionBranding {
  const inst =
    settings && typeof settings === 'object' && !Array.isArray(settings)
      ? (settings as Record<string, unknown>)
      : {};
  const ent =
    entitySettings && typeof entitySettings === 'object' && !Array.isArray(entitySettings)
      ? (entitySettings as Record<string, unknown>)
      : {};
  const branding = (ent.branding ?? inst.branding) as Record<string, unknown> | undefined;
  return {
    name: institutionName,
    logoUrl:
      (typeof ent.logoUrl === 'string' ? ent.logoUrl : undefined) ??
      (typeof branding?.logoUrl === 'string' ? branding.logoUrl : undefined),
    primaryColor:
      (typeof ent.primaryColor === 'string' ? ent.primaryColor : undefined) ??
      (typeof branding?.primaryColor === 'string' ? branding.primaryColor : '#1e3a5f'),
  };
}

export function wrapBrandedEmailHtml(branding: InstitutionBranding, bodyHtml: string): string {
  const color = branding.primaryColor ?? '#1e3a5f';
  const logo = branding.logoUrl
    ? `<img src="${branding.logoUrl}" alt="" style="max-height:48px;margin-bottom:12px" />`
    : '';
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;color:#0f172a;margin:0;padding:0">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden">
<tr><td style="background:${color};color:#fff;padding:20px 24px">${logo}<div style="font-size:18px;font-weight:600">${branding.name ?? 'Alumni'}</div></td></tr>
<tr><td style="padding:24px">${bodyHtml}</td></tr>
<tr><td style="padding:16px 24px;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0">Sent via UniCore Alumni</td></tr>
</table></td></tr></table></body></html>`;
}
