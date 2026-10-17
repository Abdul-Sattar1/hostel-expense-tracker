export const formatMoney = (n) => `${n < 0 ? '−' : ''}Rs ${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Dates travel as 'YYYY-MM-DD' strings; format them in UTC so the day never shifts with the time zone.
export const formatDate = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
