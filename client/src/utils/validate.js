const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PASSWORD_HINT = 'At least 8 characters, with a letter and a number.';

export const emailError = (v) =>
  !v.trim() ? 'Enter your email address.' : !EMAIL.test(v.trim()) ? 'Enter a valid email address, like name@example.com.' : '';

export const requiredError = (v, label) => (v.trim() ? '' : `Enter ${label}.`);

// Mirrors the server policy (server/src/validators/auth.js), which is the real enforcement.
export const passwordError = (v) =>
  !v ? 'Create a password.' : v.length < 8 ? 'Use at least 8 characters.' : !/[A-Za-z]/.test(v) || !/\d/.test(v) ? 'Include at least one letter and one number.' : '';
