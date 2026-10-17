// Single place for money totals (dashboard and reports): summed in whole paisa so decimal
// amounts never accumulate floating-point error. savingsPercent is null when there is no income
// (nothing to divide by) and negative when expenses exceed income.
export function totals(rows) {
  let income = 0;
  let expenses = 0;
  for (const t of rows) {
    const paisa = Math.round(t.amount * 100);
    if (t.type === 'income') income += paisa;
    else expenses += paisa;
  }
  return {
    income: income / 100,
    expenses: expenses / 100,
    balance: (income - expenses) / 100,
    savingsPercent: income > 0 ? Math.round(((income - expenses) * 1000) / income) / 10 : null,
    count: rows.length,
  };
}
