import { z } from 'zod';

// Keep in sync with client/src/utils/categories.js.
export const CATEGORIES = {
  income: ['Allowance', 'Salary', 'Scholarship', 'Other income'],
  expense: ['Food', 'Hostel dues', 'Transport', 'Study', 'Health', 'Entertainment', 'Other'],
};

export const amount = z
  .number({ error: 'Enter an amount.' })
  .positive('Amount must be greater than zero.')
  .max(1e9, 'Amount is too large.')
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'Use at most 2 decimal places.');

// Calendar dates travel as 'YYYY-MM-DD' and are stored as UTC midnight of that same day.
export const isoDate = z
  .string({ error: 'Choose a date.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid date.')
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v) && d.getUTCFullYear() >= 2000 && d.getUTCFullYear() <= 2100;
  }, 'Choose a valid date.');

const date = isoDate.transform((v) => new Date(`${v}T00:00:00Z`));

// Unknown keys (owner, userId, _id, ...) are dropped by zod, so they can never reach the database.
// PATCH reuses this full schema: the client sends the whole edited record, which also keeps
// type and category consistent with each other.
export const transactionSchema = z
  .object({
    type: z.enum(['income', 'expense'], { error: 'Choose income or expense.' }),
    amount,
    category: z.string({ error: 'Choose a category.' }),
    description: z.string().trim().max(200, 'Use at most 200 characters.').optional().default(''),
    date,
  })
  .refine((t) => CATEGORIES[t.type].includes(t.category), { path: ['category'], message: 'Choose a valid category for this type.' });
