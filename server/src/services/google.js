import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env.js';

const client = new OAuth2Client();

// Throws unless Google's signature, expiry and our client id (audience) all check out.
export async function verifyGoogleToken(idToken) {
  if (!env.googleClientId) throw new Error('GOOGLE_CLIENT_ID is not configured');
  const ticket = await client.verifyIdToken({ idToken, audience: env.googleClientId });
  const p = ticket.getPayload();
  return { id: p.sub, email: String(p.email ?? '').toLowerCase(), emailVerified: p.email_verified === true, name: p.name };
}
