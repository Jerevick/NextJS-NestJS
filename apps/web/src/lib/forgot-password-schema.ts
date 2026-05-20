import { z } from 'zod';

export const passwordResetRequestSchema = z.object({
  email: z.string().email(),
  institutionSlug: z.string().trim().min(2, 'Institution slug is required'),
});

export type PasswordResetRequestValues = z.infer<typeof passwordResetRequestSchema>;

export const passwordResetConfirmSchema = z
  .object({
    password: z.string().min(8, 'At least 8 characters'),
    confirmPassword: z.string().min(8),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type PasswordResetConfirmValues = z.infer<typeof passwordResetConfirmSchema>;
