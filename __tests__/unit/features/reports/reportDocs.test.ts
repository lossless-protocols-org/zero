/**
 * What a PDF report says (plan P12): the figures every screen shows (spending
 * net of refunds, R2), by category, and the entries; nothing the caller did
 * not pass can be in it. The documents built here are pinned in
 * contracts/report-doc.json, which the Android and iOS renderers both draw
 * in their own tests. After a deliberate change:
 * ZERO_UPDATE_CONTRACTS=1 bunx jest __tests__/unit/features/reports/reportDocs.test.ts
 */
import fs from 'node:fs';
import {fromRoot} from '../../../harness/paths';
import {
  MAX_LISTED_ENTRIES,
  spendingReportDoc,
  trendsReportDoc,
  type ReportWords,
  type SpendingReportInput,
} from '../../../../src/features/reports/reportDocs';
import {periodFor} from '../../../../src/domain/period';
import type {TrendPoint} from '../../../../src/domain/trends';
import type {ReportBlock, ReportDoc} from '../../../../src/pro/reportPdf';

const FILE = fromRoot('contracts', 'report-doc.json');

const words: ReportWords = {
  footer: 'Made on this phone with zero · 12 Nov 2026',
  direction: 'ltr',
  spendingTitle: 'Spending report',
  trendsTitle: 'Trends',
  spent: 'Spent',
  received: 'Money in',
  kept: 'Kept',
  refundedLine: amount => `Refunded: ${amount}`,
  avgPerDay: 'Avg/day',
  budgetLeftLine: (budget, amount) => `Budget: ${budget}. ${amount} left.`,
  budgetOverLine: (budget, amount) => `Budget: ${budget}. ${amount} over.`,
  byCategory: 'By category',
  category: 'Category',
  amount: 'Amount',
  share: 'Share',
  total: 'Total',
  entries: 'Entries',
  date: 'Date',
  title: 'Title',
  refundOf: title => `Refund: ${title}`,
  uncategorised: 'Uncategorised',
  tooManyEntries: count => `${count} entries are not listed here. Use Export as CSV for the full list.`,
  noEntries: 'No entries in these days.',
  month: 'Month',
  whatStoodOut: 'What stood out',
};
const format = {
  money: (amount: number) => `${amount < 0 ? '-' : ''}₹${Math.abs(amount).toLocaleString('en-IN')}`,
  day: (date: string) => date.slice(5, 10),
};
const food = {id: 'c_food', name: 'Food'};
const shoes = {id: 'c_shoes', name: 'Shoes'};

const november: SpendingReportInput = {
  periodLabel: '7 Nov – 6 Dec 2026',
  days: 30,
  expenses: [
    {title: 'Groceries', amount: 3000, date: '2026-11-08T10:00:00', category: food},
    {title: 'Boots', amount: 4000, date: '2026-11-10T09:00:00', category: shoes},
    {title: 'Chai', amount: 0.1, date: '2026-11-07T08:00:00', category: food},
    {title: 'Chai', amount: 0.2, date: '2026-12-06T23:00:00', category: food},
    {title: 'Parking', amount: 60, date: '2026-11-20T18:00:00'},
  ],
  refunds: [{title: 'Boots', amount: 1500, date: '2026-11-20T11:00:00', category: shoes}],
  received: 50_000,
  budget: 5000,
  categoryName: name => name,
};

const block = <T extends ReportBlock['type']>(doc: ReportDoc, type: T, nth = 0) => {
  const found = doc.blocks.filter(b => b.type === type)[nth];
  if (!found) {
    throw new Error(`no ${type} block ${nth}`);
  }
  return found as Extract<ReportBlock, {type: T}>;
};

describe('a spending report', () => {
  const doc = spendingReportDoc(november, words, format);

  it('is headed by what it covers', () => {
    expect(doc).toMatchObject({
      title: 'Spending report',
      subtitle: '7 Nov – 6 Dec 2026',
      footer: words.footer,
      direction: 'ltr',
    });
  });

  it('gives the screen’s figures: spent net of refunds, the daily average, money in and kept', () => {
    // 3000 + 4000 + 0.1 + 0.2 + 60 − 1500, exactly.
    expect(block(doc, 'stats').items).toEqual([
      {label: 'Spent', value: '₹5,560.3'},
      {label: 'Avg/day', value: format.money(5560.3 / 30)},
      {label: 'Money in', value: '₹50,000'},
      {label: 'Kept', value: '₹44,439.7'},
    ]);
    expect(block(doc, 'text', 0).text).toBe('Refunded: ₹1,500');
    expect(block(doc, 'text', 1).text).toBe('Budget: ₹5,000. ₹560.3 over.');
  });

  it('nets each category, largest first, and the rows add up to the total', () => {
    const table = block(doc, 'table', 0);
    expect(table.rows).toEqual([
      ['Food', '₹3,000.3', '54%'],
      ['Shoes', '₹2,500', '45%'],
      ['Uncategorised', '₹60', '1%'],
    ]);
    expect(table.total).toEqual(['Total', '₹5,560.3', '']);
    expect(block(doc, 'bars').rows.map(row => [row.label, row.fraction])).toEqual([
      ['Food', 1],
      ['Shoes', 2500 / 3000.3],
      ['Uncategorised', 60 / 3000.3],
    ]);
  });

  it('lists every entry by day, a refund as money back on its expense', () => {
    const entries = block(doc, 'table', 1);
    expect(entries.rows).toEqual([
      ['11-07', 'Chai', 'Food', '₹0.1'],
      ['11-08', 'Groceries', 'Food', '₹3,000'],
      ['11-10', 'Boots', 'Shoes', '₹4,000'],
      ['11-20', 'Refund: Boots', 'Shoes', '-₹1,500'],
      ['11-20', 'Parking', 'Uncategorised', '₹60'],
      ['12-06', 'Chai', 'Food', '₹0.2'],
    ]);
    expect(entries.total).toEqual(['Total', '', '', '₹5,560.3']);
  });

  it('holds only what it was given: no field of a row beyond title, amount, date and category name', () => {
    const withMore: SpendingReportInput = {
      ...november,
      expenses: november.expenses.map(row => ({
        ...row,
        // What a row carries in the store and a document for someone else must not show.
        ...{description: 'SECRET-NOTE', accountId: 'SECRET-ACCOUNT', id: 'SECRET-ID', tags: 'SECRET-TAG'},
      })),
    };
    expect(JSON.stringify(spendingReportDoc(withMore, words, format))).not.toContain('SECRET');
  });

  it('without money in, a budget or refunds, says nothing about them', () => {
    const plain = spendingReportDoc({...november, refunds: [], received: 0, budget: null}, words, format);
    expect(block(plain, 'stats').items.map(item => item.label)).toEqual(['Spent', 'Avg/day']);
    expect(plain.blocks.filter(b => b.type === 'text')).toEqual([]);
  });

  it('under budget says what is left', () => {
    const under = spendingReportDoc({...november, budget: 6000}, words, format);
    expect(block(under, 'text', 1).text).toBe('Budget: ₹6,000. ₹439.7 left.');
  });

  it('a category whose refunds outweigh its spending has no bar and no share, and is listed last', () => {
    const back = spendingReportDoc(
      {...november, refunds: [{title: 'Boots', amount: 4500, date: '2026-11-20T11:00:00', category: shoes}]},
      words,
      format,
    );
    expect(block(back, 'table', 0).rows.at(-1)).toEqual(['Shoes', '-₹500', '']);
    expect(block(back, 'bars').rows.map(row => row.label)).toEqual(['Food', 'Uncategorised']);
  });

  it('an empty period says so; too many entries are counted, not listed', () => {
    const empty = spendingReportDoc({...november, expenses: [], refunds: []}, words, format);
    expect(empty.blocks.at(-1)).toEqual({type: 'text', text: 'No entries in these days.'});
    expect(empty.blocks.some(b => b.type === 'table')).toBe(false);
    const many = spendingReportDoc(
      {
        ...november,
        refunds: [],
        expenses: Array.from({length: MAX_LISTED_ENTRIES + 1}, (_, i) => ({
          title: `Entry ${i}`,
          amount: 1,
          date: '2026-11-08T10:00:00',
          category: food,
        })),
      },
      words,
      format,
    );
    expect(many.blocks.at(-1)).toEqual({type: 'text', text: words.tooManyEntries(MAX_LISTED_ENTRIES + 1)});
    expect(many.blocks.filter(b => b.type === 'table')).toHaveLength(1);
  });

  it('a right-to-left language mirrors the page', () => {
    expect(spendingReportDoc(november, {...words, direction: 'rtl'}, format).direction).toBe('rtl');
  });
});

const point = (key: string, spent: number, received: number, byCategory: Record<string, number>): TrendPoint => ({
  key,
  period: periodFor(key),
  spent,
  refunded: 0,
  received,
  kept: received - spent,
  count: 3,
  byCategory,
});
const trend = {
  rangeLabel: 'Sep 2026 – Nov 2026',
  months: [
    {label: 'Sep 2026', point: point('2026-09', 1000.1, 5000, {c_food: 600.1, c_shoes: 400})},
    {label: 'Oct 2026', point: point('2026-10', 2000.2, 5000, {c_food: 1500.2, c_gone: 500})},
    {label: 'Nov 2026', point: point('2026-11', 500, 0, {c_food: 500})},
  ],
  insights: ['Food was your biggest category in October: 75% of spending.'],
  categories: [food, shoes],
};

describe('a trends report', () => {
  const doc = trendsReportDoc(trend, words, format);

  it('totals the months exactly and lists each', () => {
    expect(doc).toMatchObject({title: 'Trends', subtitle: 'Sep 2026 – Nov 2026'});
    expect(block(doc, 'stats').items).toEqual([
      {label: 'Spent', value: '₹3,500.3'},
      {label: 'Money in', value: '₹10,000'},
      {label: 'Kept', value: '₹6,499.7'},
    ]);
    const months = block(doc, 'table', 0);
    expect(months.rows.map(row => row[0])).toEqual(['Sep 2026', 'Oct 2026', 'Nov 2026']);
    expect(months.rows[2]).toEqual(['Nov 2026', '₹500', '₹0', '-₹500']);
    expect(months.total).toEqual(['Total', '₹3,500.3', '₹10,000', '₹6,499.7']);
    expect(block(doc, 'bars').rows.map(row => row.fraction)).toEqual([1000.1 / 2000.2, 1, 500 / 2000.2]);
  });

  it('says what the screen says stood out, in its words', () => {
    expect(doc.blocks).toContainEqual({type: 'heading', text: 'What stood out'});
    expect(doc.blocks).toContainEqual({type: 'text', text: trend.insights[0]});
    expect(trendsReportDoc({...trend, insights: []}, words, format).blocks).not.toContainEqual({
      type: 'heading',
      text: 'What stood out',
    });
  });

  it('each category across the months; a category that is gone is listed as uncategorised, so the rows add up', () => {
    const categories = block(doc, 'table', 1);
    expect(categories.rows).toEqual([
      ['Food', '₹2,600.3', '74%'],
      ['Uncategorised', '₹500', '14%'],
      ['Shoes', '₹400', '11%'],
    ]);
    expect(categories.total).toEqual(['Total', '₹3,500.3', '']);
  });
});

it('pins the documents the Android and iOS renderers draw (contracts/report-doc.json)', () => {
  // Long enough to need several pages and a table that continues across them.
  const long: SpendingReportInput = {
    ...november,
    periodLabel: 'November 2026',
    expenses: Array.from({length: 140}, (_, i) => ({
      title: i % 9 === 0 ? `A long title that has to wrap inside its column, entry number ${i}` : `Entry ${i}`,
      amount: 100 + i,
      date: `2026-11-${String((i % 30) + 1).padStart(2, '0')}T10:00:00`,
      category: i % 3 === 0 ? shoes : food,
    })),
  };
  const contract = {
    spending: spendingReportDoc(november, words, format),
    long: spendingReportDoc(long, words, format),
    trends: trendsReportDoc(trend, words, format),
    // Other scripts and a mirrored page: text is laid out by each platform, not by zero.
    rtl: spendingReportDoc(
      {
        ...november,
        periodLabel: '٧ نوفمبر – ٦ ديسمبر ٢٠٢٦',
        expenses: [
          {title: 'بقالة', amount: 3000, date: '2026-11-08T10:00:00', category: {id: 'c_food', name: 'طعام'}},
          {title: 'किराना', amount: 250, date: '2026-11-09T10:00:00', category: {id: 'c_food', name: 'طعام'}},
        ],
        refunds: [],
      },
      {...words, direction: 'rtl', spendingTitle: 'تقرير الإنفاق'},
      format,
    ),
  };
  const json = `${JSON.stringify(contract, null, 2)}\n`;
  if (process.env['ZERO_UPDATE_CONTRACTS'] === '1') {
    fs.writeFileSync(FILE, json);
  }
  expect(fs.readFileSync(FILE, 'utf8')).toBe(json);
});
