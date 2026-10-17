import crypto from 'node:crypto';

// Emailed tokens (password reset, email change): 256 random bits; only the SHA-256 hash is stored.
export const randomToken = () => crypto.randomBytes(32).toString('hex');
export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
