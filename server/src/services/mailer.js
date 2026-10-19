
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const parseFrom = (value = '') => {
  const m = /^(.*)<([^>]+)>\s*$/.exec(value);
  return m
    ? { name: m[1].trim().replace(/^"|"$/g, '') || undefined, email: m[2].trim() }
    : { email: value.trim() };
};

async function sendViaBrevo(to, subject, text) {
  const sender = parseFrom(env.mail.from);
  if (!sender.email) throw new Error('MAIL_FROM is required with BREVO_API_KEY');

  console.log('[email] Sending request to Brevo');

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': env.mail.brevoKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender,
      to: [{ email: to }],
      subject,
      textContent: text,
    }),
    signal: AbortSignal.timeout(10000),
  });

  const details = await res.text();
  console.log('[email] Brevo response status:', res.status);

  if (!res.ok) {
    console.error(`[email] Brevo rejected request (${res.status}): ${details}`);
    throw new Error(`Email provider rejected the request (HTTP ${res.status})`);
  }

  console.log('[email] Brevo accepted email:', details);
}

async function deliver(to, subject, text, link) {
  const { host, port, user, pass, from, brevoKey } = env.mail;

  if (brevoKey) {
    console.log('[email] Brevo API selected');
    return sendViaBrevo(to, subject, text);
  }

  console.log('[email] Brevo key missing; checking SMTP');

  if (!host) {
    if (env.isProd) throw new Error('No email provider is configured');
    console.log(`[dev] No email provider configured. Link for ${to}: ${link}`);
    return;
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass } : undefined,
  });

  await transport.sendMail({ from: from ?? user, to, subject, text });
}

export const sendResetEmail = (to, link, minutes) =>
  deliver(
    to,
    'Reset your Hostel Expense Tracker password',
    `Use this link to choose a new password. It expires in ${minutes} minutes and works once.

${link}

If you did not ask for this, ignore this email; your password stays the same.`,
    link,
  );

export const sendVerificationEmail = (to, link, minutes) =>
  deliver(
    to,
    'Confirm your new Hostel Expense Tracker email',
    `Use this link to confirm this address for your account. It expires in ${minutes} minutes and works once.

${link}

If you did not ask for this, ignore this email; nothing will change.`,
    link,
  );
