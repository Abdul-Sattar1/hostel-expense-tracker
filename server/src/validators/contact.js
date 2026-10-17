import { z } from 'zod';
import { email, text } from './auth.js';

// `website` is a honeypot: hidden from people, so only bots fill it in.
export const contactSchema = z.object({
  name: text('Name').trim().min(2, 'Enter your name.').max(80, 'Use at most 80 characters.'),
  email,
  subject: z.string().trim().max(120, 'Use at most 120 characters.').optional().default(''),
  message: text('Message').trim().min(10, 'Write at least 10 characters so we can understand your message.').max(2000, 'Use at most 2000 characters.'),
  website: z.string().max(200).optional().default(''),
});
