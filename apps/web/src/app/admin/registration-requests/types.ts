export type RegistrationRequestStatus = 'PENDING' | 'REVIEWED' | 'PROVISIONED' | 'DISMISSED';
export type RegistrationRequestKind = 'NEW_INSTITUTION' | 'JOIN_INSTITUTION';

export type RegistrationRequestRow = {
  id: string;
  kind: RegistrationRequestKind;
  status: RegistrationRequestStatus;
  email: string;
  institutionSlug: string | null;
  institutionId: string | null;
  payload: RegistrationRequestPayload;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  reviewedAt: string | null;
  institution?: { id: string; name: string; slug: string } | null;
};

export type RegistrationRequestDetail = RegistrationRequestRow & {
  documents: {
    logoUrl: string | null;
    accreditationEvidenceUrl: string | null;
  };
};

export type RegistrationRequestPayload = {
  institutionName?: string;
  institutionType?: string;
  institutionEmail?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    stateProvince?: string;
    postalCode?: string;
    country?: string;
  };
  accreditation?: {
    status?: string;
    body?: string;
    reference?: string;
    validUntil?: string;
  };
  contact?: {
    firstName?: string;
    lastName?: string;
    fullName?: string;
    title?: string;
    phone?: string;
    email?: string;
  };
  logoKey?: string;
  logoFileName?: string;
  accreditationEvidenceKey?: string;
  accreditationEvidenceFileName?: string;
  country?: string;
  estimatedStudents?: string;
  corePackages?: string[];
  modulesEffective?: string[];
  bundledWithSis?: string[];
  bundledWithLms?: string[];
  sisLmsBridgeRequested?: boolean;
  message?: string;
};
