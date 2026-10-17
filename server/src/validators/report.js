import { z } from 'zod';
import { isoDate } from './transaction.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const utc = (y, m, d) => new Date(Date.UTC(y, m, d));
const text = (v) => (typeof v === 'string' ? v : undefined);

// Query string -> { label, tag, start, end }. Ranges are calendar dates matched against the stored
// UTC-midnight transaction dates: start inclusive, end exclusive (the day after the last day).
// `tag` is only digits, dashes and 'all', so it is safe in a filename.
export const reportQuery = z
  .object({
    period: z.enum(['month', 'year', 'custom', 'all'], { error: 'Choose a report type.' }),
    month: z.preprocess(text, z.string().optional()),
    year: z.preprocess(text, z.string().optional()),
    from: z.preprocess(text, z.string().optional()),
    to: z.preprocess(text, z.string().optional()),
  })
  .transform((q, ctx) => {
    const bad = (path, message) => {
      ctx.addIssue({ code: 'custom', path: [path], message });
      return z.NEVER;
    };
    const yearOf = (v) => (/^\d{4}$/.test(v ?? '') && v >= 2000 && v <= 2100 ? Number(v) : null);

    if (q.period === 'all') return { label: 'All records', tag: 'all', start: null, end: null };
    if (q.period === 'year') {
      const y = yearOf(q.year);
      if (!y) return bad('year', 'Enter a year between 2000 and 2100.');
      return { label: `Year ${y}`, tag: String(y), start: utc(y, 0, 1), end: utc(y + 1, 0, 1) };
    }
    if (q.period === 'month') {
      const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(q.month ?? '');
      const y = m && yearOf(m[1]);
      if (!y) return bad('month', 'Choose a valid month and year.');
      const i = Number(m[2]) - 1;
      return { label: `${MONTHS[i]} ${y}`, tag: q.month, start: utc(y, i, 1), end: utc(y, i + 1, 1) };
    }
    const from = isoDate.safeParse(q.from);
    const to = isoDate.safeParse(q.to);
    if (!from.success) return bad('from', 'Choose a valid start date.');
    if (!to.success) return bad('to', 'Choose a valid end date.');
    if (from.data > to.data) return bad('to', 'End date must be on or after the start date.');
    const end = new Date(`${to.data}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    return { label: `${from.data} to ${to.data}`, tag: `${from.data}_to_${to.data}`, start: new Date(`${from.data}T00:00:00Z`), end };
  });
