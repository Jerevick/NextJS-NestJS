/** Slug for institution provisioning from a display name. */
export function slugFromInstitutionName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export type RegistrationRequestRow = {
  id: string;
  kind: 'JOIN_INSTITUTION' | 'NEW_INSTITUTION';
  status: 'PENDING' | 'REVIEWED' | 'DISMISSED';
  email: string;
  institutionSlug: string | null;
  institutionId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  reviewedAt: string | null;
  institution?: { id: string; name: string; slug: string } | null;
  documents?: {
    logoUrl: string | null;
    accreditationEvidenceUrl: string | null;
  };
};

export type InstitutionAddress = {
  line1?: string;
  line2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
};

export type InstitutionAccreditation = {
  status?: string;
  body?: string;
  reference?: string;
  validUntil?: string;
};

export type InstitutionContact = {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  title?: string;
  phone?: string;
  email?: string;
};

export type NewInstitutionPayload = {
  institutionName?: string;
  institutionType?: string;
  institutionEmail?: string;
  address?: InstitutionAddress;
  accreditation?: InstitutionAccreditation;
  contact?: InstitutionContact;
  contactName?: string;
  country?: string;
  estimatedStudents?: string;
  corePackages?: string[];
  modulesEffective?: string[];
  message?: string;
  logoKey?: string;
  logoFileName?: string;
  accreditationEvidenceKey?: string;
  accreditationEvidenceFileName?: string;
};

export type JoinInstitutionPayload = {
  fullName?: string;
  role?: string;
  notes?: string;
};

function formatAddress(address?: InstitutionAddress): string {
  if (!address) return '';
  return [
    address.line1,
    address.line2,
    [address.city, address.stateProvince, address.postalCode].filter(Boolean).join(', '),
    address.country,
  ]
    .filter(Boolean)
    .join('\n');
}

export function registrationRequestSummary(row: RegistrationRequestRow): string {
  if (row.kind === 'NEW_INSTITUTION') {
    const p = row.payload as NewInstitutionPayload;
    return p.institutionName ?? row.email;
  }
  const p = row.payload as JoinInstitutionPayload;
  const slug = row.institutionSlug ?? row.institution?.slug ?? '—';
  return `${p.fullName ?? row.email} · ${slug}`;
}

export function provisionDefaultsFromRequest(row: RegistrationRequestRow) {
  if (row.kind !== 'NEW_INSTITUTION') {
    return null;
  }
  const p = row.payload as NewInstitutionPayload;
  const institutionName = p.institutionName?.trim() ?? '';
  if (!institutionName) {
    return null;
  }

  const contact = p.contact;
  const contactName =
    contact?.fullName ??
    [contact?.firstName, contact?.lastName].filter(Boolean).join(' ') ??
    p.contactName?.trim() ??
    '';
  const nameParts = contactName.split(/\s+/).filter(Boolean);

  return {
    slug: slugFromInstitutionName(institutionName),
    name: institutionName,
    adminEmail: contact?.email ?? row.email,
    adminFirstName: contact?.firstName ?? nameParts[0] ?? contactName,
    adminLastName:
      contact?.lastName ?? (nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined),
    institutionEmail: p.institutionEmail,
    logoUrl: row.documents?.logoUrl ?? null,
    notes: [
      p.institutionType ? `Type: ${p.institutionType}` : null,
      p.institutionEmail ? `Institutional email: ${p.institutionEmail}` : null,
      formatAddress(p.address)
        ? `Address:\n${formatAddress(p.address)}`
        : p.country
          ? `Country: ${p.country}`
          : null,
      p.accreditation?.status
        ? `Accreditation: ${p.accreditation.status}${p.accreditation.body ? ` (${p.accreditation.body})` : ''}`
        : null,
      p.accreditation?.reference ? `Accreditation ref: ${p.accreditation.reference}` : null,
      contact?.title ? `Contact title: ${contact.title}` : null,
      contact?.phone ? `Contact phone: ${contact.phone}` : null,
      p.estimatedStudents ? `Est. students: ${p.estimatedStudents}` : null,
      p.corePackages?.length ? `Packages: ${p.corePackages.join(', ')}` : null,
      p.message ? `Message: ${p.message}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

export function formatAccreditationLabel(status?: string): string {
  switch (status) {
    case 'accredited':
      return 'Fully accredited';
    case 'provisional':
      return 'Provisional';
    case 'application_pending':
      return 'Application pending';
    case 'not_accredited':
      return 'Not accredited';
    default:
      return status ?? '—';
  }
}
