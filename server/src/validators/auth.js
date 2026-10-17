import { z } from 'zod';

export const text = (label) => z.string({ error: `${label} is required.` });
export const email = text('Email').trim().toLowerCase().email('Enter a valid email address.').max(254);

export const password = text('Password')
  .min(8, 'Use at least 8 characters.')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Include at least one letter and one number.')
  .refine((v) => Buffer.byteLength(v) <= 72, 'Use at most 72 bytes (about 72 characters).');

export const registerSchema = z.object({
  name: text('Name').trim().min(2, 'Enter your full name.').max(80, 'Use at most 80 characters.'),
  email,
  password,
});

export const googleSchema = z.object({ credential: text('Google credential').min(1).max(4096) });

export const forgotSchema = z.object({ email });

export const resetSchema = z.object({ token: text('Reset token').min(1).max(200), password });

export const loginSchema = z.object({
  email,
  password: text('Password').min(1, 'Enter your password.').max(128),
});
