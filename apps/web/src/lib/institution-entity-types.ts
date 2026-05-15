/** Mirrors Prisma `InstitutionEntityType` — keep in sync with packages/database schema */
export const INSTITUTION_ENTITY_TYPES = [
  {
    value: 'MAIN_CAMPUS',
    label: 'Main campus',
    description: 'Primary university body; only one allowed per institution.',
  },
  { value: 'SCHOOL', label: 'School', description: 'Semi-autonomous school (e.g. School of Medicine).' },
  { value: 'EXTRAMURAL', label: 'Extramural', description: 'Continuing / evening division.' },
  { value: 'DISTANCE_LEARNING', label: 'Distance learning', description: 'Online / remote division.' },
  { value: 'SATELLITE_CAMPUS', label: 'Satellite campus', description: 'Branch campus in another city or region.' },
  {
    value: 'PROFESSIONAL_SCHOOL',
    label: 'Professional school',
    description: 'Law, business, or similar professional school.',
  },
  { value: 'SUMMER_SCHOOL', label: 'Summer school', description: 'Seasonal programmes.' },
  { value: 'RESEARCH_INSTITUTE', label: 'Research institute', description: 'Research centre or institute.' },
  {
    value: 'CONSTITUENT_COLLEGE',
    label: 'Constituent college',
    description: 'Tightly coupled affiliated college.',
  },
  { value: 'AFFILIATE', label: 'Affiliate', description: 'Loosely coupled external partner.' },
] as const;

export type InstitutionEntityTypeValue = (typeof INSTITUTION_ENTITY_TYPES)[number]['value'];
