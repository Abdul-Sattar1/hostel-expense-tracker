
const nodeEnv = process.env.NODE_ENV ?? 'development';

export const env = {
  nodeEnv,
  isProd: nodeEnv === 'production',
  port: Number(process.env.PORT) || 5000,
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  bcryptRounds: nodeEnv === 'test' ? 4 : 12,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  appUrl: (process.env.APP_URL ?? process.env.RENDER_EXTERNAL_URL ?? process.env.CLIENT_ORIGIN ?? 'http://localhost:5173').replace(/\/$/, ''),
  mail: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM,
    brevoKey: process.env.BREVO_API_KEY,
    resetTemplateId: Number(process.env.BREVO_RESET_TEMPLATE_ID) || 0,
    emailChangeTemplateId: Number(process.env.BREVO_EMAIL_CHANGE_TEMPLATE_ID) || 0,
  },
  authRateLimit: Number(process.env.AUTH_RATE_LIMIT) || 10,
};

export function assertConfig() {
  const problems = [];
  if (env.isProd && !env.mongoUri) problems.push('MONGODB_URI is required in production.');
  if (env.isProd && !env.jwtSecret) problems.push('JWT_SECRET is required in production.');
  if (env.isProd && !env.mail.host && !env.mail.brevoKey) console.warn('No email provider configured (SMTP_HOST or BREVO_API_KEY): password-reset and email-change emails cannot be sent.');
  if (env.isProd && env.appUrl.includes('localhost')) console.warn('APP_URL is not set: emailed links would point to localhost.');
  if (env.jwtSecret && env.jwtSecret.length < 32) problems.push('JWT_SECRET must be at least 32 characters.');
  if (problems.length) throw new Error(`Invalid configuration:\n- ${problems.join('\n- ')}`);
  if (!env.isProd && !env.jwtSecret) console.warn('JWT_SECRET not set: login and registration are disabled.');
}
