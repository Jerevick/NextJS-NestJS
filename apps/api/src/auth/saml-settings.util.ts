import { decryptSensitiveJson, encryptSensitiveJson } from '../common/crypto/field-encryption';

export type InstitutionSamlConfig = {
  entryPoint: string;
  issuer: string;
  idpCert: string;
  audience?: string;
  wantAssertionsSigned?: boolean;
};

export type InstitutionAuthSettings = {
  ssoProvider?: 'GOOGLE' | 'MICROSOFT' | 'SAML' | 'PASSWORD';
  saml?: InstitutionSamlConfig | { _enc: true; v: number; payload: string };
};

export function parseInstitutionAuthSettings(raw: unknown): InstitutionAuthSettings {
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  return raw as InstitutionAuthSettings;
}

export function resolveSamlConfig(settings: InstitutionAuthSettings): InstitutionSamlConfig | null {
  if (settings.ssoProvider !== 'SAML' || !settings.saml) {
    return null;
  }
  const raw = settings.saml;
  const decrypted = decryptSensitiveJson(raw);
  if (decrypted && typeof decrypted === 'object') {
    return decrypted as InstitutionSamlConfig;
  }
  if (typeof raw === 'object' && 'entryPoint' in raw && 'issuer' in raw) {
    return raw as InstitutionSamlConfig;
  }
  return null;
}

export function encryptSamlConfig(config: InstitutionSamlConfig) {
  return encryptSensitiveJson(config);
}
