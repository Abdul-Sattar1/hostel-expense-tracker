
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const parseFrom = (value = '') => {
  const m = /^(.*)<([^>]+)>\s*$/.exec(value);
  return m
    ? { name: m[1].trim().replace(/^"|"$/g, '') || undefined, email: m[2].trim() }
    : { email: value.trim() };
};

async function sendViaBrevo(to, subject, text, templateId, params) {
  const sender = parseFrom(env.mail.from);
  if (!sender.email) throw new Error('MAIL_FROM is required with BREVO_API_KEY');

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
      templateId,
      params,
    }),
    signal: AbortSignal.timeout(25000),
  });

  const details = await res.text();
  console.log('[email] Brevo response status:', res.status);

  if (!res.ok) {
    console.error(`[email] Brevo rejected request (${res.status}): ${details}`);
    throw new Error(`Email provider rejected the request (HTTP ${res.status})`);
  }

  console.log('[email] Brevo accepted email:', details);
}

async function deliver(to, subject, text, link, templateId, params) {
  const { host, port, user, pass, from, brevoKey } = env.mail;

  if (brevoKey) {
    if (!templateId) throw new Error('Brevo template ID is missing');
    return sendViaBrevo(to, subject, text, templateId, params);
  }

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
    'Reset your password | Hostel Expense Tracker',
    `Use this link to choose a new password. It expires in ${minutes} minutes and works once.\n\n${link}\n\nIf you did not ask for this, ignore this email; your password stays the same.`,
    link,
    env.mail.resetTemplateId,
    { name: 'there', reset_url: link },
  );

export const sendVerificationEmail = (to, link, minutes) =>
  deliver(
    to,
    'Confirm your email change | Hostel Expense Tracker',
    `Use this link to confirm this address for your account. It expires in ${minutes} minutes and works once.\n\n${link}\n\nIf you did not ask for this, ignore this email; nothing will change.`,
    link,
    env.mail.emailChangeTemplateId,
    { name: 'there', new_email: to, confirm_url: link },
  );
