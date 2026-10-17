import { z } from 'zod';
import { email, password, text } from './auth.js';

// Only these fields are ever read from the client; anything else (role, id, hashes, ...) is dropped.
export const profileSchema = z.object({ name: text('Name').trim().min(2, 'Enter your full name.').max(80, 'Use at most 80 characters.') });

export const emailChangeSchema = z.object({ email, password: z.string().max(128).optional() });

export const verifyEmailSchema = z.object({ token: text('Token').min(1).max(200) });

export const passwordChangeSchema = z.object({
  currentPassword: text('Current password').min(1, 'Enter your current password.').max(128),
  newPassword: password,
});

export const preferencesSchema = z.object({
  reportPeriod: z.enum(['month', 'year', 'all'], { error: 'Choose a reporting period.' }),
  landingPage: z.enum(['dashboard', 'transactions', 'budgets', 'reports'], { error: 'Choose a landing page.' }),
});

// Re-authentication: the password, or for Google-only accounts a fresh Google credential.
export const deleteAccountSchema = z.object({
  password: z.string().max(128).optional(),
  credential: z.string().max(4096).optional(),
  confirmation: z.literal('DELETE', { error: 'Type DELETE to confirm.' }),
});
