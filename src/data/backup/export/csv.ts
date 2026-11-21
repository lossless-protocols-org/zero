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
 * - An `Account` column (3.0), last so 2.8's columns keep their places, and
 *   only when the user has more than one account: with one, every row would
 *   say the same thing. Names as stored (the default is "Cash" in every language).
 */

const BOM = '﻿';
const CRLF = '\r\n';
// `Type` is appended so spreadsheets built on the 2.7 columns keep working.
const HEADER = ['Date', 'Title', 'Description', 'Category', 'Amount', 'Type'];
const ACCOUNT_HEADER = 'Account';

type CsvData = Pick<ExportData, 'expenses' | 'incomes'> & {accounts?: ExportData['accounts']};

type EntryType = 'expense' | 'refund' | 'income';

interface CsvRow {
  date: string;
  title: string;
  description: string;
  category: string;
  amount: number;
  type: EntryType;
  account: string;
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
const rowsOf = (data: CsvData, defaultAccount: string): CsvRow[] => [
  ...data.expenses.flatMap(expense => {
    // An omitted account is the default (envelope v5); a refund's omitted account is its expense's (v6).
    const paidFrom = expense.account ?? defaultAccount;
    return [
      {
        date: expense.date,
        title: expense.title,
        description: expense.description ?? '',
        category: expense.category.name,
        amount: expense.amount,
        type: 'expense' as const,
        account: paidFrom,
      },
      ...(expense.refunds ?? []).map(refund => ({
        date: refund.date,
        title: expense.title,
        description: refund.note,
        category: expense.category.name,
        amount: refund.amount,
        type: 'refund' as const,
        account: refund.account ?? paidFrom,
      })),
    ];
  }),
  ...data.incomes.map(income => ({
    date: income.date,
    title: income.note || income.category.name,
    description: '',
    category: income.category.name,
    amount: income.amount,
    type: 'income' as const,
    account: income.account ?? defaultAccount,
  })),
];

export const entriesToCsv = (data: CsvData): string => {
  const accounts = data.accounts ?? [];
  const withAccounts = accounts.length > 1;
  const defaultAccount = accounts.find(account => account.isDefault)?.name ?? '';
  const header = withAccounts ? [...HEADER, ACCOUNT_HEADER] : HEADER;
  const rows = rowsOf(data, defaultAccount)
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
        ...(withAccounts ? [escapeField(row.account)] : []),
      ].join(','),
    );

  return BOM + [header.join(','), ...rows].join(CRLF) + CRLF;
};
