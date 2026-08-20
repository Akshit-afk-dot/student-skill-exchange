import { z } from 'zod';

/**
 * Password policy: length is the dominant factor in resistance to guessing, so the
 * floor is 8 with a mixed-character requirement rather than a maze of rules that push
 * users toward "Passw0rd!".
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .refine((v) => /[a-zA-Z]/.test(v), 'Password must contain a letter')
  .refine((v) => /[0-9]/.test(v), 'Password must contain a number');

export const emailSchema = z.email('Enter a valid email address').toLowerCase().trim();

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: emailSchema,
  password: passwordSchema,
  college: z.string().trim().max(140).optional(),
  department: z.string().trim().max(140).optional(),
  year: z.coerce.number().int().min(1).max(8).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const googleSchema = z.object({
  idToken: z.string().min(10, 'A Google ID token is required'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  email: emailSchema,
  otp: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code from your email'),
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(10),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const pushTokenSchema = z.object({
  token: z.string().min(10).max(512),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
