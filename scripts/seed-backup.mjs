#!/usr/bin/env node
/**
 * Writes a zero backup (export envelope v5) with N expenses spread over the
 * last 5 years, 16 expense and 2 income categories, 5 debtors with debts, one
 * currency, two budgets, the default account, about one refund per 30
 * expenses and two incomes a month — the "10k seed" every §2.4a measurement
 * refers to. Refunds and incomes are drawn AFTER everything else, so the
 * expenses, debts and budgets are the same as in the v4 seed for a given N.
 *
 *   node scripts/seed-backup.mjs 10000                 → references/seeds/zero_seed_10000.json
 *   node scripts/seed-backup.mjs 10000 --compact        → no indentation (what L4 would ship)
 *   node scripts/seed-backup.mjs 200 --out /tmp/x.json  → explicit path
 *   node scripts/seed-backup.mjs 200 --anchor 2026-11-01 → the five years end on that day
 *   node scripts/seed-backup.mjs 10000 --accounts      → envelope v6 with positions (3.0, plan P8):
 *     a bank, a card and an investment beside Cash, entries spread over them,
 *     200 transfers (SIP, card bill, cash withdrawals) and 12 checkpoints whose
 *     gaps are the true gaps against the file's own rows
 *
 * Deterministic for a given N and anchor (seeded PRNG), so two runs produce
 * the same file and timings are comparable. The anchor defaults to today, so
 * a seed restored on a device has this month's rows; tests pass a fixed one
 * (__tests__/harness/seed.ts), so a suite sees the same data on every day and
 * every machine (audit 2026-11-08 §7.5). Restore it through onboarding →
 * "I have a backup" → pick the file (adb push it to /sdcard/Download first).
 *
 * The shape mirrors src/data/backup/export/validate.ts exactly; the key follows
 * src/data/backup/export/key.ts (prefix "zero" + 16 URL-safe chars = 20).
 */
import {writeFileSync, mkdirSync, statSync} from 'node:fs';
import {dirname, resolve} from 'node:path';

const args = process.argv.slice(2);
const count = Number.parseInt(args[0] ?? '', 10);
if (!Number.isInteger(count) || count < 1) {
  console.error(
    'Usage: node scripts/seed-backup.mjs <expenses> [--compact] [--out <path>] [--anchor YYYY-MM-DD] [--accounts]',
  );
  process.exit(1);
}
const compact = args.includes('--compact');
const withAccounts = args.includes('--accounts');
const outFlag = args.indexOf('--out');
const outPath = resolve(
  outFlag !== -1 ? args[outFlag + 1] : `references/seeds/zero_seed_${count}${withAccounts ? '_accounts' : ''}.json`,
);
const anchorFlag = args.indexOf('--anchor');
const anchorArg = anchorFlag !== -1 ? args[anchorFlag + 1] : undefined;
if (anchorArg !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(anchorArg)) {
  console.error(`--anchor takes a day as YYYY-MM-DD, got ${anchorArg}`);
  process.exit(1);
}

// mulberry32 — small, deterministic, good enough for test data.
/* eslint-disable no-bitwise -- mulberry32 is defined on 32-bit integer operations */
let state = (count * 2654435761) >>> 0;
const rand = () => {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
/* eslint-enable no-bitwise */
const pick = list => list[Math.floor(rand() * list.length)];
const between = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

const KEY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
const key = 'zero' + Array.from({length: 16}, () => KEY_ALPHABET[Math.floor(rand() * KEY_ALPHABET.length)]).join('');

const pad = n => String(n).padStart(2, '0');
const isoLocal = d =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const yearMonth = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

// Anchor to local midnight: two runs with the same anchor produce byte-identical output.
const today = anchorArg ? new Date(`${anchorArg}T00:00:00`) : new Date();
const now = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
const start = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate(), 0, 0, 0);
const spanMs = now.getTime() - start.getTime();

// 10 defaults (same names/icons/colours as assets/jsons/defaultCategories.json) + 6 extras.
const categories = [
  ['Food', 'utensils-crossed', '#6E8E55'],
  ['Transportation', 'bus', '#9E8420'],
  ['Entertainment', 'gamepad-2', '#4588BB'],
  ['Healthcare', 'bandaid', '#D06850'],
  ['Shopping', 'shopping-bag', '#A870A8'],
  ['Travel', 'plane', '#D25555'],
  ['Utilities', 'wifi', '#BF6B30'],
  ['Education', 'notebook', '#9575B8'],
  ['Gifts', 'gift', '#7D8225'],
  ['Other', 'circle-dot', '#758595'],
  ['Fuel', 'car', '#A67C20'],
  ['Grocery', 'shopping-cart', '#CC5577'],
  ['Rent', 'house', '#2E8B8B'],
  ['Coffee', 'coffee', '#C06040'],
  ['Subscriptions', 'tv', '#3D9090'],
  ['Pantry', 'receipt', '#8A7D72'],
].map(([name, icon, color], index) => ({
  name,
  categoryStatus: true,
  icon,
  color,
  kind: 'expense',
  sortOrder: (index + 1) * 10,
}));
// Free has one income category (src/domain/freeTier.ts): the seed is a Free
// user, so salary and freelance work both go into it, told apart by the note.
const incomeCategories = [['Income', 'coins', '#3D9960']].map(([name, icon, color], index) => ({
  name,
  categoryStatus: true,
  icon,
  color,
  kind: 'income',
  sortOrder: (index + 1) * 10,
}));

/** What the app derives for a row without timestamps: its local date read as UTC (src/domain/isoEpoch.ts). */
const epochOf = iso => {
  const [y, mo, d, h = 0, mi = 0, se = 0] = iso.split(/[-T:]/).map(Number);
  return Date.UTC(y, mo - 1, d, h, mi, se);
};

// Weighted so a few categories dominate, like real data.
const weights = [18, 10, 6, 3, 8, 2, 4, 2, 2, 3, 9, 14, 5, 7, 3, 4];
const weightedCategory = () => {
  let r = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return categories[i].name;
  }
  return categories[0].name;
};

const TITLES = {
  Food: ['Lunch', 'Dinner', 'Biryani', 'Dosa', 'Snacks', 'Thali'],
  Transportation: ['Auto', 'Metro', 'Bus pass', 'Cab', 'Toll'],
  Entertainment: ['Movie', 'Concert', 'Game', 'Bowling'],
  Healthcare: ['Pharmacy', 'Doctor', 'Lab test'],
  Shopping: ['Clothes', 'Shoes', 'Electronics', 'Amazon'],
  Travel: ['Flight', 'Hotel', 'Train', 'Taxi'],
  Utilities: ['Electricity', 'Water', 'Internet', 'Phone'],
  Education: ['Course', 'Books', 'Exam fee'],
  Gifts: ['Birthday gift', 'Wedding gift'],
  Other: ['Misc', 'Repair', 'Donation'],
  Fuel: ['Petrol', 'Diesel', 'Service'],
  Grocery: ['Vegetables', 'Milk', 'Weekly groceries', 'Fruits'],
  Rent: ['House rent', 'Maintenance'],
  Coffee: ['Filter coffee', 'Latte', 'Chai'],
  Subscriptions: ['Netflix', 'Spotify', 'Cloud storage'],
  Pantry: ['Rice', 'Oil', 'Spices', 'Snacks'],
};
const RANGES = {
  Rent: [12000, 25000],
  Travel: [800, 15000],
  Shopping: [300, 8000],
  Electronics: [2000, 40000],
  Fuel: [500, 3000],
  Healthcare: [100, 4000],
  Utilities: [200, 2500],
  Subscriptions: [99, 1499],
  Education: [500, 20000],
  Gifts: [300, 5000],
};

const expenses = [];
for (let i = 0; i < count; i++) {
  const category = weightedCategory();
  const date = new Date(start.getTime() + rand() * spanMs);
  const [lo, hi] = RANGES[category] ?? [20, 900];
  const amount = between(lo, hi);
  const title = pick(TITLES[category] ?? ['Expense']);
  expenses.push({
    title: `${title}`,
    amount,
    description: rand() < 0.3 ? `Seed ${i + 1}` : '',
    category: {name: category},
    date: isoLocal(date),
  });
}
// The app sorts newest first; keep the file in random order so the import
// path (which does not sort) is exercised as the real one is.

const debtors = [
  {title: 'Rohit', debtorStatus: true, icon: 'user', type: 'Person', color: '#3A85B5'},
  {title: 'Yuva', debtorStatus: true, icon: 'user', type: 'Person', color: '#3A85B5'},
  {title: 'Priya', debtorStatus: true, icon: 'user', type: 'Person', color: '#3A85B5'},
  {title: 'HDFC Card', debtorStatus: true, icon: 'credit-card', type: 'Credit Card', color: '#D06850'},
  {title: 'Car Loan', debtorStatus: true, icon: 'landmark', type: 'Loan', color: '#3D9960'},
];
const debts = [];
for (let i = 0; i < Math.min(60, Math.max(10, Math.round(count / 200))); i++) {
  const debtor = pick(debtors);
  const date = new Date(start.getTime() + rand() * spanMs);
  debts.push({
    amount: between(200, 20000),
    description: pick(['Dinner split', 'Loan', 'Rent share', 'Trip', 'EMI', 'Repayment']),
    debtor: {title: debtor.title},
    date: isoLocal(date),
    type: rand() < 0.5 ? 'Borrow' : 'Lend',
  });
}

const threeYearsAgo = new Date(now.getFullYear() - 3, now.getMonth(), 1);
const budgets = [
  {amount: 30000, month: `recurring:${yearMonth(threeYearsAgo)}`, budgetType: 'monthly'},
  {amount: 5000, month: yearMonth(now), budgetType: 'category', category: {name: 'Food'}},
];

// v5: refunds on about one expense in 30 (partial, within 20 days, never
// after today), and two incomes a month (salary on the 7th, a freelance job).
const isoDay = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const refundsByIndex = new Map();
for (let r = 0; r < Math.floor(count / 30); r++) {
  const index = Math.floor(rand() * expenses.length);
  const expense = expenses[index];
  if (refundsByIndex.has(index) || expense.amount < 2) continue;
  const parsed = new Date(expense.date);
  const back = new Date(Math.min(parsed.getTime() + between(0, 20) * 86_400_000, now.getTime()));
  refundsByIndex.set(index, [
    {amount: between(1, expense.amount - 1), date: isoLocal(back), note: rand() < 0.5 ? 'Returned' : ''},
  ]);
}
const incomes = [];
for (let month = new Date(start.getFullYear(), start.getMonth() + 1, 1); month < now;) {
  const salaryDay = new Date(month.getFullYear(), month.getMonth(), 7);
  if (salaryDay < now) {
    incomes.push({amount: 50000, date: isoDay(salaryDay), category: {name: 'Income'}, note: 'Salary'});
  }
  const jobDay = new Date(month.getFullYear(), month.getMonth(), between(1, 28));
  if (jobDay < now) {
    incomes.push({amount: between(2, 20) * 500, date: isoDay(jobDay), category: {name: 'Income'}, note: 'Freelance'});
  }
  month = new Date(month.getFullYear(), month.getMonth() + 1, 1);
}

// 3.0 positions (--accounts), drawn after everything above so the rest of the
// file is the same as without the flag for a given N and anchor.
const BANK = 'HDFC';
const CARD = 'Amex';
const FUND = 'Index fund';
const accounts = [
  {name: 'Cash', type: 'cash', openingBalance: 0, openingDate: null, isDefault: true, icon: 'wallet', color: '#6E8B3D'},
  ...(withAccounts
    ? [
        {
          name: BANK,
          type: 'bank',
          openingBalance: 25000,
          openingDate: isoDay(start),
          isDefault: false,
          icon: 'landmark',
          color: '#3A85B5',
        },
        {
          name: CARD,
          type: 'card',
          openingBalance: 0,
          openingDate: null,
          isDefault: false,
          icon: 'credit-card',
          color: '#D06850',
        },
        {
          name: FUND,
          type: 'investment',
          openingBalance: 100000,
          openingDate: isoDay(start),
          isDefault: false,
          icon: 'trending-up',
          color: '#3D9960',
        },
      ]
    : []),
].map((account, index) => ({
  name: account.name,
  type: account.type,
  currency: 'INR',
  openingBalance: account.openingBalance,
  openingDate: account.openingDate,
  isDefault: account.isDefault,
  accountStatus: true,
  sortOrder: index,
  icon: account.icon,
  color: account.color,
}));
const expenseAccount = new Map();
const refundAccount = new Map();
const incomeAccount = new Map();
const debtAccount = new Map();
const transfers = [];
const checkpoints = [];
if (withAccounts) {
  expenses.forEach((expense, index) => {
    const draw = rand();
    if (draw < 0.25) expenseAccount.set(index, CARD);
    else if (draw < 0.45) expenseAccount.set(index, BANK);
  });
  // A card refund now and then comes back to the bank (a refund's own account, v6).
  for (const index of refundsByIndex.keys()) {
    if (expenseAccount.get(index) === CARD && rand() < 0.3) refundAccount.set(index, BANK);
  }
  incomes.forEach((income, index) => {
    if (income.note === 'Salary') incomeAccount.set(index, BANK);
  });
  debts.forEach((_debt, index) => {
    if (rand() < 0.3) debtAccount.set(index, BANK);
  });
  const cardSpend = new Map(); // 'YYYY-MM' → card spending that month
  expenses.forEach((expense, index) => {
    if (expenseAccount.get(index) === CARD) {
      const month = expense.date.slice(0, 7);
      cardSpend.set(month, (cardSpend.get(month) ?? 0) + expense.amount);
    }
  });
  const transfer = (from, to, amount, date, note) => {
    if (amount > 0 && date <= isoDay(now)) transfers.push({fromAccount: from, toAccount: to, amount, date, note});
  };
  for (let month = new Date(start.getFullYear(), start.getMonth() + 1, 1); month < now;) {
    const previous = yearMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1));
    transfer(
      BANK,
      CARD,
      cardSpend.get(previous) ?? 0,
      isoDay(new Date(month.getFullYear(), month.getMonth(), 5)),
      'Card bill',
    );
    transfer(BANK, FUND, 5000, isoDay(new Date(month.getFullYear(), month.getMonth(), 10)), 'SIP');
    transfer(
      BANK,
      'Cash',
      between(3, 10) * 1000,
      isoDay(new Date(month.getFullYear(), month.getMonth(), between(1, 28))),
      'ATM',
    );
    month = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  }
  while (transfers.length < 200) {
    transfer('Cash', BANK, between(1, 20) * 500, isoDay(new Date(start.getTime() + rand() * spanMs)), 'Deposit');
  }
  transfers.splice(200);
  // The file's own rows replayed (as netWorthService reads them): each checkpoint's gap is
  // its balance minus what the rows and the checkpoints before it give at the end of its day.
  const units = amount => Math.round(amount * 10_000);
  const events = new Map(accounts.map(account => [account.name, []]));
  const on = (name, date, amount) => events.get(name ?? 'Cash').push({day: date.slice(0, 10), units: units(amount)});
  expenses.forEach((e, i) => on(expenseAccount.get(i), e.date, -e.amount));
  for (const [i, list] of refundsByIndex)
    for (const r of list) on(refundAccount.get(i) ?? expenseAccount.get(i), r.date, r.amount);
  incomes.forEach((income, i) => on(incomeAccount.get(i), income.date, income.amount));
  debts.forEach((d, i) => {
    if (debtAccount.has(i)) on(debtAccount.get(i), d.date, d.type === 'Borrow' ? d.amount : -d.amount);
  });
  for (const t of transfers) {
    on(t.fromAccount, t.date, -t.amount);
    on(t.toAccount, t.date, t.amount);
  }
  const balanceOn = (name, day) => {
    const account = accounts.find(a => a.name === name);
    const anchor = checkpoints.filter(c => c.account === name && c.date <= day).at(-1);
    const after = anchor?.date ?? null;
    const opening =
      account.openingDate === null
        ? after === null
          ? units(account.openingBalance)
          : 0
        : (after === null || account.openingDate > after) && account.openingDate <= day
          ? units(account.openingBalance)
          : 0;
    const flows = events
      .get(name)
      .filter(e => (after === null || e.day > after) && e.day <= day)
      .reduce((s, e) => s + e.units, 0);
    return (anchor ? units(anchor.balance) : 0) + opening + flows;
  };
  const checkpointDays = [];
  for (let k = 1; k <= 12; k++) {
    checkpointDays.push({
      account: k % 3 === 0 ? BANK : FUND,
      day: isoDay(new Date(start.getTime() + (spanMs * k) / 12.5)),
    });
  }
  for (const {account, day} of checkpointDays) {
    const derived = balanceOn(account, day);
    // An investment drifts with the market; a bank account is off by what was never entered.
    const balanceUnits =
      account === FUND
        ? Math.round((derived * (1000 + between(-30, 60))) / 1000 / 10_000) * 10_000
        : derived - between(0, 2000) * 10_000;
    checkpoints.push({
      account,
      balance: balanceUnits / 10_000,
      date: day,
      gap: (balanceUnits - derived) / 10_000,
      kind: account === FUND ? 'revaluation' : 'adjustment',
      note: account === FUND ? 'Statement' : 'Bank app',
    });
  }
}

// Key order is src/data/backup/export/validate.ts's schema order, so the export of
// an imported seed is byte-identical to the seed (exportRoundTrip.test.ts).
const stamped = row => ({createdAt: epochOf(row.date), updatedAt: epochOf(row.date)});
const envelope = {
  key,
  version: withAccounts ? 6 : 5,
  data: {
    users: [{username: 'Seed', email: ''}],
    categories: [...categories, ...incomeCategories],
    expenses: expenses.map((expense, index) => {
      const refunds = refundsByIndex.get(index);
      return {
        ...expense,
        ...(expenseAccount.has(index) ? {account: expenseAccount.get(index)} : {}),
        ...stamped(expense),
        ...(refunds
          ? {
              refunds: refunds.map(refund => ({
                ...refund,
                ...stamped(refund),
                ...(refundAccount.has(index) ? {account: refundAccount.get(index)} : {}),
              })),
            }
          : {}),
      };
    }),
    currencies: [{code: 'INR', symbol: '₹', name: 'Indian Rupee'}],
    debtors,
    debts: debts.map((debt, index) => ({
      ...debt,
      ...stamped(debt),
      ...(debtAccount.has(index) ? {account: debtAccount.get(index)} : {}),
    })),
    budgets,
    accounts,
    incomes: incomes.map((income, index) => ({
      ...income,
      ...(incomeAccount.has(index) ? {account: incomeAccount.get(index)} : {}),
      ...stamped(income),
    })),
    ...(withAccounts
      ? {
          transfers: transfers.map(t => ({...t, ...stamped(t)})),
          checkpoints: checkpoints.map(c => ({...c, ...stamped(c)})),
        }
      : {}),
  },
};

mkdirSync(dirname(outPath), {recursive: true});
const json = JSON.stringify(envelope, null, compact ? 0 : 2);
writeFileSync(outPath, json);
const bytes = statSync(outPath).size;
const rows =
  expenses.length +
  refundsByIndex.size +
  incomes.length +
  categories.length +
  incomeCategories.length +
  debtors.length +
  debts.length +
  budgets.length +
  accounts.length +
  transfers.length +
  checkpoints.length +
  2;
console.log(`${outPath}`);
console.log(
  `${bytes} bytes · ${expenses.length} expenses · ${refundsByIndex.size} refunds · ${incomes.length} incomes · ${accounts.length} accounts · ${transfers.length} transfers · ${checkpoints.length} checkpoints · ${rows} rows · ${(bytes / rows).toFixed(0)} B/row · ${compact ? 'compact' : 'indent 2'}`,
);
