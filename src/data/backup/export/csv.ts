import type {ExportData} from './validate';
import {compareDateKeys, toDayKey} from '../../../domain/dates';

/**
 * CSV export of every money entry, for spreadsheets: expenses, their refunds
 * and incomes, one row each, with a `Type` column (export v5). Amounts stay
 * positive; Type says the direction (R1). This is a one-way convenience
 * format: the JSON envelope remains the ONLY restore format, so this module
 * deliberately does not participate in CURRENT_EXPORT_VERSION / the upgrader
 * contract in format.ts.
 *
 * Spreadsheet-friendliness choices:
 * - RFC 4180 quoting (fields containing comma/quote/newline are quoted,
 *   inner quotes doubled) with CRLF line endings.
 * - A UTF-8 BOM prefix so Excel detects the encoding and renders ₹ and
 *   non-Latin category names instead of mojibake.
 * - Amounts as plain dot-decimal numbers — no symbol, no grouping — so every
 *   spreadsheet parses them as numbers.
 */

const BOM = '﻿';
const CRLF = '\r\n';
// `Type` is appended so spreadsheets built on the 2.7 columns keep working.
const HEADER = ['Date', 'Title', 'Description', 'Category', 'Amount', 'Type'];

type EntryType = 'expense' | 'refund' | 'income';

interface CsvRow {
  date: string;
  title: string;
  description: string;
  category: string;
  amount: number;
  type: EntryType;
}

/**
 * Neutralises spreadsheet formula injection.
 *
 * Category names, titles and descriptions are free text the user types. A
 * value beginning `=`, `+`, `-`, `@` or a control character is executed as a
 * FORMULA by Excel, Numbers and Google Sheets when the CSV is opened — so an
 * expense titled `=HYPERLINK("http://x","click")` becomes a live link in a
 * file the user may well forward to someone else.
 *
 * Prefixing with an apostrophe is the standard mitigation: spreadsheets treat
 * the rest as literal text and do not display the apostrophe itself. Applied
 * to TEXT columns only — amounts must stay machine-parseable, and a negative
 * amount legitimately starts with `-`.
 */
// Leading spaces (and a zero-width space) too: Sheets and Numbers trim them,
// then evaluate what follows (M33). Full-width ＝＋－＠ are formulas in
// East Asian Excel.
const NEUTRALISE_LEADING = /^[\s\u200B]*[=+\-@\t\r\uFF1D\uFF0B\uFF0D\uFF20]/;

const escapeField = (value: string): string => {
  const guarded = NEUTRALISE_LEADING.test(value) ? `'${value}` : value;
  if (/[",\r\n]/.test(guarded)) {
    return `"${guarded.replaceAll('"', '""')}"`;
  }
  return guarded;
};

/**
 * A refund carries its expense's title and category (it is money back on
 * that purchase); an income's title is its note, else its category.
 */
const rowsOf = (data: Pick<ExportData, 'expenses' | 'incomes'>): CsvRow[] => [
  ...data.expenses.flatMap(expense => [
    {
      date: expense.date,
      title: expense.title,
      description: expense.description ?? '',
      category: expense.category.name,
      amount: expense.amount,
      type: 'expense' as const,
    },
    ...(expense.refunds ?? []).map(refund => ({
      date: refund.date,
      title: expense.title,
      description: refund.note,
      category: expense.category.name,
      amount: refund.amount,
      type: 'refund' as const,
    })),
  ]),
  ...data.incomes.map(income => ({
    date: income.date,
    title: income.note || income.category.name,
    description: '',
    category: income.category.name,
    amount: income.amount,
    type: 'income' as const,
  })),
];

export const entriesToCsv = (data: Pick<ExportData, 'expenses' | 'incomes'>): string => {
  const rows = rowsOf(data)
    // The local day (toDayKey), as every screen shows it; the time part is noise in a spreadsheet.
    .map(row => ({...row, day: toDayKey(row.date)}))
    // Stable sort: same-day rows keep expense, its refunds, then incomes. Code-unit order
    // (compareDateKeys), not localeCompare: no ICU collation per comparison.
    .sort((a, b) => compareDateKeys(a.day, b.day, 1))
    .map(row =>
      [
        escapeField(row.day),
        escapeField(row.title),
        escapeField(row.description),
        escapeField(row.category),
        String(row.amount),
        row.type,
      ].join(','),
    );

  return BOM + [HEADER.join(','), ...rows].join(CRLF) + CRLF;
};
