import { z } from 'zod';
import { amount, CATEGORIES } from './transaction.js';

// Unknown keys (owner, userId, spent, ...) are dropped. PATCH reuses this full schema.
export const budgetSchema = z.object({
  category: z.enum(CATEGORIES.expense, { error: 'Choose an expense category.' }),
  limit: amount,
});
