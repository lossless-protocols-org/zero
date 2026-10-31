#!/usr/bin/env node
/**
 * Writes a zero backup (export envelope v4) with N expenses spread over the
 * last 5 years, 16 categories, 5 debtors with debts, one currency and two
 * budgets — the "10k seed" every §2.4a measurement refers to.
 *
 *   node scripts/seed-backup.mjs 10000                 → references/seeds/zero_seed_10000.json
 *   node scripts/seed-backup.mjs 10000 --compact        → no indentation (what L4 would ship)
 *   node scripts/seed-backup.mjs 200 --out /tmp/x.json  → explicit path
 *
 * Deterministic for a given N (seeded PRNG), so two runs produce the same
 * file and timings are comparable. Restore it through onboarding →
 * "I have a backup" → pick the file (adb push it to /sdcard/Download first).
 *
 * The shape mirrors src/backend/export/validate.ts exactly; the key follows
 * src/backend/export/key.ts (prefix "zero" + 16 URL-safe chars = 20).
 */
import {writeFileSync, mkdirSync, statSync} from 'node:fs';
import {dirname, resolve} from 'node:path';

const args = process.argv.slice(2);
const count = Number.parseInt(args[0] ?? '', 10);
if (!Number.isInteger(count) || count < 1) {
  console.error('Usage: node scripts/seed-backup.mjs <expenses> [--compact] [--out <path>]');
  process.exit(1);
}
const compact = args.includes('--compact');
const outFlag = args.indexOf('--out');
const outPath = resolve(outFlag !== -1 ? args[outFlag + 1] : `references/seeds/zero_seed_${count}.json`);

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

// Anchor to local midnight so two runs on the same day produce byte-identical output.
const today = new Date();
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
].map(([name, icon, color]) => ({name, categoryStatus: true, icon, color}));

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

const envelope = {
  key,
  version: 4,
  data: {
    users: [{username: 'Seed', email: ''}],
    categories,
    expenses,
    currencies: [{code: 'INR', symbol: '₹', name: 'Indian Rupee'}],
    debtors,
    debts,
    budgets,
  },
};

mkdirSync(dirname(outPath), {recursive: true});
const json = JSON.stringify(envelope, null, compact ? 0 : 2);
writeFileSync(outPath, json);
const bytes = statSync(outPath).size;
const rows = expenses.length + categories.length + debtors.length + debts.length + budgets.length + 2;
console.log(`${outPath}`);
console.log(
  `${bytes} bytes · ${expenses.length} expenses · ${rows} rows · ${(bytes / rows).toFixed(0)} B/row · ${compact ? 'compact' : 'indent 2'}`,
);
