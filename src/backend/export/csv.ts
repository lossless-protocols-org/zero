import type {ExportData} from './validate';

/**
 * CSV export of expenses, for spreadsheets. This is a one-way convenience
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
const HEADER = ['Date', 'Title', 'Description', 'Category', 'Amount'];

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

export const expensesToCsv = (expenses: ExportData['expenses']): string => {
  const rows = [...expenses]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(expense =>
      [
        // Keep the date portion only; the time part is noise in a spreadsheet.
        escapeField(expense.date.slice(0, 10)),
        escapeField(expense.title),
        escapeField(expense.description ?? ''),
        escapeField(expense.category.name),
        String(expense.amount),
      ].join(','),
    );

  return BOM + [HEADER.join(','), ...rows].join(CRLF) + CRLF;
};
