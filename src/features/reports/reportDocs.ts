import {toDayKey} from '../../domain/dates';
import {fromMoneyUnits, toMoneyUnits} from '../../domain/money';
import {keptOf, spendingOf} from '../../domain/periodMath';
import type {TrendPoint} from '../../domain/trends';
import type {ReportBlock, ReportDoc} from '../../pro/reportPdf';

/**
 * What a PDF report says (3.0, plan P12; Pro key `reports`). Pure: the
 * caller hands over the rows and figures its screen shows, the words (the
 * app's language) and the formatters (the app's money and dates), and gets
 * the document the native side draws. So a report holds what the screen it
 * was made from shows and nothing else, and that is tested here, without a
 * phone: no account, no tag, no row from outside the period can reach it
 * unless the caller passes it.
 *
 * Spending is netted exactly as every screen nets it (domain/periodMath, R2):
 * a refund lowers the period it is dated in, under its expense's category.
 */

/**
 * Past this many entries a report lists none: a year of rows is a CSV's job, not forty pages.
 * @internal Used by spendingReportDoc; tests check the limit.
 */
export const MAX_LISTED_ENTRIES = 500;

interface Formatters {
  money: (amount: number) => string;
  /** A stored date as a short day, e.g. "7 Nov". */
  day: (date: string) => string;
}

export interface ReportWords {
  footer: string;
  direction: 'ltr' | 'rtl';
  spendingTitle: string;
  trendsTitle: string;
  spent: string;
  received: string;
  kept: string;
  /** Whole sentences, so each language orders its own words. */
  refundedLine: (amount: string) => string;
  avgPerDay: string;
  budgetLeftLine: (budget: string, left: string) => string;
  budgetOverLine: (budget: string, over: string) => string;
  byCategory: string;
  category: string;
  amount: string;
  share: string;
  total: string;
  entries: string;
  date: string;
  title: string;
  refundOf: (title: string) => string;
  uncategorised: string;
  tooManyEntries: (count: number) => string;
  noEntries: string;
  month: string;
  whatStoodOut: string;
}

interface SpendRow {
  title: string;
  amount: number;
  date: string;
  category?: {id: string; name: string};
}

export interface SpendingReportInput {
  /** The days covered, as the screen's header says them. */
  periodLabel: string;
  /** How many days the period has (for the daily average the screen shows). */
  days: number;
  expenses: readonly SpendRow[];
  /** The refunds dated in the period, each with its expense's title and category. */
  refunds: readonly SpendRow[];
  /** Money in during the period; 0 shows no money-in figures, as on the screen. */
  received: number;
  /** The overall budget of the month, when the screen shows one (a picked range has none). */
  budget: number | null;
  /** A category's name as the app shows it (translated defaults). */
  categoryName: (name: string) => string;
}

const percentOf = (part: number, whole: number): string => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '');

/** Net spending per category, largest first; a category whose refunds outweigh its spending is last, negative. */
const byCategory = (
  expenses: readonly SpendRow[],
  refunds: readonly SpendRow[],
  nameOf: (row: SpendRow) => string,
): Array<{name: string; amount: number}> => {
  const units = new Map<string, {name: string; units: number}>();
  const add = (row: SpendRow, sign: 1 | -1): void => {
    const key = row.category?.id ?? '';
    const group = units.get(key) ?? {name: nameOf(row), units: 0};
    group.units += sign * toMoneyUnits(row.amount);
    units.set(key, group);
  };
  expenses.forEach(row => add(row, 1));
  refunds.forEach(row => add(row, -1));
  return [...units.values()]
    .map(group => ({name: group.name, amount: fromMoneyUnits(group.units)}))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
};

/** A month's (or a picked range's) spending as a document: the figures, by category, and every entry. */
export const spendingReportDoc = (input: SpendingReportInput, words: ReportWords, format: Formatters): ReportDoc => {
  const {expenses, refunds, received} = input;
  const spending = spendingOf(expenses, refunds);
  const nameOf = (row: SpendRow): string =>
    row.category ? input.categoryName(row.category.name) : words.uncategorised;
  const blocks: ReportBlock[] = [];

  const stats = [
    {label: words.spent, value: format.money(spending.spent)},
    {label: words.avgPerDay, value: format.money(input.days > 0 ? spending.spent / input.days : 0)},
  ];
  if (received > 0) {
    stats.push({label: words.received, value: format.money(received)});
    stats.push({label: words.kept, value: format.money(keptOf(received, spending.spent))});
  }
  blocks.push({type: 'stats', items: stats});
  if (spending.refunded > 0) {
    blocks.push({type: 'text', text: words.refundedLine(format.money(spending.refunded))});
  }
  if (input.budget !== null && input.budget > 0) {
    const left = fromMoneyUnits(toMoneyUnits(input.budget) - toMoneyUnits(spending.spent));
    blocks.push({
      type: 'text',
      text:
        left >= 0
          ? words.budgetLeftLine(format.money(input.budget), format.money(left))
          : words.budgetOverLine(format.money(input.budget), format.money(-left)),
    });
  }

  const categories = byCategory(expenses, refunds, nameOf);
  if (categories.length > 0) {
    const largest = Math.max(...categories.map(category => category.amount), 0);
    blocks.push({type: 'heading', text: words.byCategory});
    blocks.push({
      type: 'bars',
      rows: categories
        .filter(category => category.amount > 0)
        .map(category => ({
          label: category.name,
          value: format.money(category.amount),
          fraction: largest > 0 ? category.amount / largest : 0,
        })),
    });
    blocks.push({
      type: 'table',
      columns: [
        {title: words.category, align: 'start', weight: 5},
        {title: words.amount, align: 'end', weight: 3},
        {title: words.share, align: 'end', weight: 2},
      ],
      rows: categories.map(category => [
        category.name,
        format.money(category.amount),
        category.amount > 0 ? percentOf(category.amount, spending.spent) : '',
      ]),
      total: [words.total, format.money(spending.spent), ''],
    });
  }

  blocks.push({type: 'heading', text: words.entries});
  const listed = [
    ...expenses.map(row => ({row, sign: 1 as const})),
    ...refunds.map(row => ({row, sign: -1 as const})),
  ].sort((a, b) => toDayKey(a.row.date).localeCompare(toDayKey(b.row.date)) || a.sign - b.sign);
  if (listed.length === 0) {
    blocks.push({type: 'text', text: words.noEntries});
  } else if (listed.length > MAX_LISTED_ENTRIES) {
    blocks.push({type: 'text', text: words.tooManyEntries(listed.length)});
  } else {
    blocks.push({
      type: 'table',
      columns: [
        {title: words.date, align: 'start', weight: 2},
        {title: words.title, align: 'start', weight: 5},
        {title: words.category, align: 'start', weight: 3},
        {title: words.amount, align: 'end', weight: 3},
      ],
      rows: listed.map(({row, sign}) => [
        format.day(row.date),
        sign === 1 ? row.title : words.refundOf(row.title),
        nameOf(row),
        format.money(sign * row.amount),
      ]),
      total: [words.total, '', '', format.money(spending.spent)],
    });
  }

  return {
    title: words.spendingTitle,
    subtitle: input.periodLabel,
    footer: words.footer,
    direction: words.direction,
    blocks,
  };
};

export interface TrendsReportInput {
  /** The stretch covered, e.g. "Dec 2025 – Nov 2026". */
  rangeLabel: string;
  /** The months, oldest first, each with the label the screen gives it. */
  months: ReadonlyArray<{label: string; point: TrendPoint}>;
  /** The facts the screen says about the last finished month, already worded. */
  insights: readonly string[];
  /** The categories' names as the app shows them; spending under any other id is listed as uncategorised. */
  categories: ReadonlyArray<{id: string; name: string}>;
}

/** Several months side by side as a document: month by month, what stood out, and each category across the months. */
export const trendsReportDoc = (input: TrendsReportInput, words: ReportWords, format: Formatters): ReportDoc => {
  const points = input.months.map(month => month.point);
  const sum = (pick: (point: TrendPoint) => number): number =>
    fromMoneyUnits(points.reduce((total, point) => total + toMoneyUnits(pick(point)), 0));
  const spent = sum(point => point.spent);
  const received = sum(point => point.received);
  const blocks: ReportBlock[] = [
    {
      type: 'stats',
      items: [
        {label: words.spent, value: format.money(spent)},
        {label: words.received, value: format.money(received)},
        {label: words.kept, value: format.money(keptOf(received, spent))},
      ],
    },
  ];

  const largest = Math.max(...points.map(point => point.spent), 0);
  blocks.push({type: 'heading', text: words.spent});
  blocks.push({
    type: 'bars',
    rows: input.months.map(({label, point}) => ({
      label,
      value: format.money(point.spent),
      fraction: largest > 0 ? Math.max(point.spent, 0) / largest : 0,
    })),
  });
  blocks.push({
    type: 'table',
    columns: [
      {title: words.month, align: 'start', weight: 4},
      {title: words.spent, align: 'end', weight: 3},
      {title: words.received, align: 'end', weight: 3},
      {title: words.kept, align: 'end', weight: 3},
    ],
    rows: input.months.map(({label, point}) => [
      label,
      format.money(point.spent),
      format.money(point.received),
      format.money(point.kept),
    ]),
    total: [words.total, format.money(spent), format.money(received), format.money(keptOf(received, spent))],
  });

  if (input.insights.length > 0) {
    blocks.push({type: 'heading', text: words.whatStoodOut});
    input.insights.forEach(text => blocks.push({type: 'text', text}));
  }

  // Every category any month names: the listed ones by name, and whatever is left (a category
  // since deleted, a refund whose expense is gone) together, so the rows add up to the total.
  const names = new Map(input.categories.map(category => [category.id, category.name]));
  const totals = new Map<string, number>();
  for (const id of new Set(points.flatMap(point => Object.keys(point.byCategory)))) {
    const name = names.get(id) ?? words.uncategorised;
    totals.set(name, (totals.get(name) ?? 0) + toMoneyUnits(sum(point => point.byCategory[id] ?? 0)));
  }
  const rows = [...totals]
    .map(([name, units]) => ({name, total: fromMoneyUnits(units)}))
    .filter(row => row.total !== 0)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  if (rows.length > 0) {
    blocks.push({type: 'heading', text: words.byCategory});
    blocks.push({
      type: 'table',
      columns: [
        {title: words.category, align: 'start', weight: 5},
        {title: words.amount, align: 'end', weight: 3},
        {title: words.share, align: 'end', weight: 2},
      ],
      rows: rows.map(row => [row.name, format.money(row.total), row.total > 0 ? percentOf(row.total, spent) : '']),
      total: [words.total, format.money(spent), ''],
    });
  }

  return {
    title: words.trendsTitle,
    subtitle: input.rangeLabel,
    footer: words.footer,
    direction: words.direction,
    blocks,
  };
};
