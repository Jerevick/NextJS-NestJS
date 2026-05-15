import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'At least 8 characters'),
  institutionSlug: z.string().trim().min(2, 'Institution slug is required'),
  mfaToken: z.string().optional(),
  rememberMe: z.boolean().optional(),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
