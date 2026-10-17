import PDFDocument from 'pdfkit';
import { env } from '../config/env.js';

const TITLE = 'Hostel Expense Tracker';
const money = (n) => `Rs ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const typeLabel = (t) => (t.type === 'income' ? 'Income' : 'Expense');
// Pakistan calendar date of generation, as YYYY-MM-DD.
export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });

// A cell starting with = + - @ (or tab/CR) can run as a formula in Excel/Sheets, so text gets a
// leading apostrophe; then quote it if it contains a comma, quote or line break.
function cell(value) {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function toCsv({ period, totals, transactions }) {
  const rows = [
    ['Report', TITLE],
    ['Period', period.label],
    ['Generated', today()],
    ['Total income', totals.income.toFixed(2)],
    ['Total expenses', totals.expenses.toFixed(2)],
    ['Net balance', totals.balance.toFixed(2)],
    ['Transactions', totals.count],
    [],
    ['Date', 'Type', 'Category', 'Description', 'Amount (Rs)'],
    ...transactions.map((t) => [t.date, typeLabel(t), t.category, t.description, t.amount.toFixed(2)]),
  ];
  // BOM so Excel opens it as UTF-8; CRLF line ends per RFC 4180.
  return `﻿${rows.map((r) => r.map(cell).join(',')).join('\r\n')}\r\n`;
}

const INSTITUTION = ['Mehran University of Engineering and Technology (MUET)', 'SZAB Campus Khairpur Mirs', 'Department of Software Engineering'];
const CREDIT = 'Developed by : K22SW012,X-50 & 10';
const COPYRIGHT = '© 2026 Department of Software Engineering, MUET SZAB Campus Khairpur Mirs. All rights reserved.';
const C = { brand: '#1e3a8a', ink: '#111827', muted: '#6b7280', line: '#d1d5db', stripe: '#f3f4f6', income: '#047857', incomeBg: '#e6f6ef', expense: '#b91c1c', expenseBg: '#fdecec', neutralBg: '#e8eefc', warn: '#92400e' };
const BUDGET_STATUS = { ok: ['On track', C.income], warning: ['Approaching limit', C.warn], exceeded: ['Over budget', C.expense] };
const L = 40;
const W = 515;

const TX_COLS = [
  { title: 'Date', width: 64 },
  { title: 'Type', width: 52 },
  { title: 'Category', width: 100 },
  { title: 'Description', width: 199 },
  { title: 'Amount', width: 100, align: 'right' },
];
const BUDGET_COLS = [
  { title: 'Category', width: 120 },
  { title: 'Monthly limit', width: 90, align: 'right' },
  { title: 'Spent', width: 90, align: 'right' },
  { title: 'Remaining', width: 90, align: 'right' },
  { title: 'Used', width: 55, align: 'right' },
  { title: 'Status', width: 70 },
];

// Resolves with the finished PDF as a Buffer (so a failure never leaves a half-sent download).
// `student` comes from the authenticated user record; `budgets` are this month's budget statuses.
export function toPdf({ period, totals, transactions, student, budgets = [] }) {
  return new Promise((resolve, reject) => {
    // Uncompressed in tests so the text can be inspected.
    const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 64, left: L, right: L }, bufferPages: true, compress: env.nodeEnv !== 'test', info: { Title: `${TITLE} - ${period.label}`, Author: TITLE } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const limit = () => doc.page.height - doc.page.margins.bottom;
    const style = (size, bold, color) => doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(color);
    const ensure = (space) => { if (doc.y + space > limit()) doc.addPage(); };

    // Branded header band.
    doc.rect(0, 0, doc.page.width, 84).fill(C.brand);
    style(20, true, '#ffffff').text(TITLE, L, 22, { lineBreak: false });
    style(11, false, '#dbe4ff').text('Expense and Budget Report', L, 50, { lineBreak: false });
    INSTITUTION.forEach((line, i) => style(i ? 8.5 : 9, !i, '#ffffff').text(line, L + 230, 20 + i * 14, { width: W - 230, align: 'right', lineBreak: false }));

    // Student and period details.
    doc.y = 100;
    const pair = (a, b) => {
      const y = doc.y;
      const field = ([label, value], x) => {
        style(7.5, false, C.muted).text(label.toUpperCase(), x, y, { width: 250 });
        style(10, true, C.ink).text(value, x, y + 10, { width: 250 });
        return doc.y;
      };
      const end = Math.max(field(a, L), b ? field(b, L + 265) : 0);
      doc.y = end + 8;
    };
    pair(['Student', student.name || 'Not provided'], ['Report period', period.label]);
    pair(['Email', student.email || 'Not provided'], ['Date range', period.range ?? 'All dates']);
    pair(['Generated', `${today()} (Pakistan time, Asia/Karachi)`]);
    doc.y += 4;

    // Summary boxes: income green, expenses red, balance blue (red if negative), count neutral.
    const boxes = [
      ['Total income', `+${money(totals.income)}`, C.income, C.incomeBg],
      ['Total expenses', `-${money(totals.expenses)}`, C.expense, C.expenseBg],
      ['Remaining balance', `${totals.balance < 0 ? '-' : ''}${money(Math.abs(totals.balance))}`, totals.balance < 0 ? C.expense : C.brand, C.neutralBg],
      ['Transactions', String(totals.count), C.ink, C.stripe],
    ];
    const bw = (W - 30) / 4;
    const by = doc.y;
    boxes.forEach(([label, value, color, bg], i) => {
      const x = L + i * (bw + 10);
      doc.roundedRect(x, by, bw, 46, 4).fill(bg);
      doc.rect(x, by, 3, 46).fill(color);
      style(8, false, C.muted).text(label, x + 10, by + 8, { width: bw - 14 });
      style(10.5, true, color).text(value, x + 10, by + 24, { width: bw - 14 });
    });
    doc.y = by + 46 + 16;

    const heading = (title) => {
      ensure(70);
      style(12, true, C.brand).text(title, L, doc.y, { width: W });
      doc.moveTo(L, doc.y + 2).lineTo(L + W, doc.y + 2).lineWidth(1).strokeColor(C.brand).stroke();
      doc.y += 8;
    };

    // Draws a row if it fits on this page; otherwise starts a new page and returns false.
    const row = (cols, rawCells, { head, stripe }) => {
      const pad = 5;
      const cells = rawCells.map((c) => (typeof c === 'string' ? { text: c } : c));
      const height = Math.max(...cols.map((c, i) => {
        style(9, head || cells[i].bold, C.ink);
        return doc.heightOfString(cells[i].text, { width: c.width - pad * 2 });
      })) + pad * 2;
      if (doc.y + height > limit()) {
        doc.addPage();
        return false;
      }
      const y = doc.y;
      if (head) doc.rect(L, y, W, height).fill(C.brand);
      else if (stripe) doc.rect(L, y, W, height).fill(C.stripe);
      let x = L;
      cols.forEach((c, i) => {
        style(9, head || cells[i].bold, head ? '#ffffff' : cells[i].color ?? C.ink).text(cells[i].text, x + pad, y + pad, { width: c.width - pad * 2, align: c.align ?? 'left' });
        x += c.width;
      });
      if (!head) doc.moveTo(L, y + height).lineTo(L + W, y + height).lineWidth(0.5).strokeColor(C.line).stroke();
      doc.y = y + height;
      return true;
    };
    // The header repeats at the top of every page the table continues onto.
    const table = (cols, rows) => {
      const titles = cols.map((c) => c.title);
      const header = () => {
        ensure(60);
        if (!row(cols, titles, { head: true })) row(cols, titles, { head: true });
      };
      header();
      rows.forEach((cells, i) => {
        if (!row(cols, cells, { stripe: i % 2 === 1 })) {
          header();
          row(cols, cells, { stripe: i % 2 === 1 });
        }
      });
    };

    heading(`Budget status: ${new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })} (as at generation)`);
    if (!budgets.length) {
      style(9, false, C.muted).text('No monthly budgets are set.', L, doc.y, { width: W });
    } else {
      table(BUDGET_COLS, budgets.map((b) => {
        const [label, color] = BUDGET_STATUS[b.status];
        return [b.category, money(b.limit), money(b.spent), `${b.remaining < 0 ? '-' : ''}${money(Math.abs(b.remaining))}`, `${b.percentUsed}%`, { text: label, color, bold: true }];
      }));
    }
    doc.y += 18;

    heading('Transactions');
    if (!transactions.length) {
      style(9, false, C.muted).text('No transactions match this period.', L, doc.y, { width: W });
    } else {
      table(TX_COLS, transactions.map((t) => {
        const income = t.type === 'income';
        const color = income ? C.income : C.expense;
        return [t.date, { text: typeLabel(t), color, bold: true }, t.category, t.description, { text: `${income ? '+' : '-'}${money(t.amount)}`, color, bold: true }];
      }));
    }

    // Footer and page numbers on every page (the bottom margin is lifted so drawing there adds no page).
    const { start, count } = doc.bufferedPageRange();
    for (let i = start; i < start + count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0;
      const y = doc.page.height - 50;
      doc.moveTo(L, y - 6).lineTo(L + W, y - 6).lineWidth(0.5).strokeColor(C.line).stroke();
      style(7.5, false, C.muted).text(CREDIT, L, y, { width: 330, lineBreak: false });
      style(7.5, false, C.muted).text(COPYRIGHT, L, y + 12, { width: W, lineBreak: false });
      style(8, true, C.ink).text(`Page ${i + 1} of ${count}`, L + 335, y, { width: W - 335, align: 'right', lineBreak: false });
    }
    doc.end();
  });
}
