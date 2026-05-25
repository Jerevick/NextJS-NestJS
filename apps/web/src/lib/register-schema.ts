import { z } from 'zod';
import { CORE_PACKAGE_IDS } from './unicore-module-catalog';

export const ACCREDITATION_STATUS_VALUES = [
  'accredited',
  'provisional',
  'application_pending',
  'not_accredited',
] as const;

export const newInstitutionSchema = z
  .object({
    institutionName: z.string().trim().min(2, 'Full legal name is required'),
    institutionType: z.enum(['university', 'college', 'polytechnic', 'other']),
    institutionEmail: z.string().trim().email('Enter a valid institutional email'),
    addressLine1: z.string().trim().min(3, 'Street address is required'),
    addressLine2: z.string().trim().max(200).optional(),
    city: z.string().trim().min(2, 'City is required'),
    stateProvince: z.string().trim().min(2, 'State / province is required'),
    postalCode: z.string().trim().min(2, 'Postal code is required'),
    country: z.string().trim().min(2, 'Country is required'),
    accreditationStatus: z.enum(ACCREDITATION_STATUS_VALUES),
    accreditationBody: z.string().trim().max(200).optional(),
    accreditationReference: z.string().trim().max(120).optional(),
    accreditationValidUntil: z.string().trim().max(32).optional(),
    contactFirstName: z.string().trim().min(1, 'First name is required'),
    contactLastName: z.string().trim().min(1, 'Last name is required'),
    contactTitle: z.string().trim().min(2, 'Job title is required'),
    contactPhone: z.string().trim().min(6, 'Phone number is required'),
    contactEmail: z.string().trim().email('Enter a valid contact email'),
    estimatedStudents: z.enum(['under-500', '500-2000', '2000-10000', '10000-plus']),
    modulesInterested: z.array(z.enum(CORE_PACKAGE_IDS)).min(1, 'Select at least one core package'),
    message: z.string().trim().max(1000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.accreditationStatus !== 'not_accredited') {
      if (!data.accreditationBody || data.accreditationBody.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Accrediting body is required for this accreditation status',
          path: ['accreditationBody'],
        });
      }
    }
  });

export type NewInstitutionValues = z.infer<typeof newInstitutionSchema>;
