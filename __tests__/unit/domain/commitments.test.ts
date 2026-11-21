/**
 * What is already spoken for (UX revamp v2): which recurring entries take
 * money out of what the user can spend, what they add up to, and what the
 * accounts hold to spend. The sample household of the v2 design.
 */
import {
  billsInBudget,
  foldByRule,
  lessOf,
  oldestCheckOf,
  stillToPay,
  toSpendOf,
  type Due,
} from '../../../src/domain/commitments';

const due = (over: Partial<Due>): Due => ({
  ruleId: 'r',
  index: 0,
  day: '2026-11-15',
  title: 'Netflix',
  target: 'expense',
  amount: 649,
  leaves: true,
  ...over,
});

const upcoming: Due[] = [
  due({ruleId: 'netflix'}),
  due({ruleId: 'milk', title: 'Milk', day: '2026-11-16', amount: 420}),
  due({ruleId: 'milk', title: 'Milk', day: '2026-11-23', amount: 420, index: 1}),
  due({ruleId: 'milk', title: 'Milk', day: '2026-11-30', amount: 420, index: 2}),
  due({ruleId: 'power', title: 'Electricity', day: '2026-11-20', amount: null}),
  due({ruleId: 'sip', title: 'SIP', day: '2026-11-25', target: 'transfer', amount: 5000}),
  due({ruleId: 'card', title: 'Card bill', day: '2026-11-28', target: 'transfer', amount: 9000}),
  due({ruleId: 'prime', title: 'Prime on the card', day: '2026-11-29', amount: 299, leaves: false}),
  due({ruleId: 'pay', title: 'Salary', day: '2026-12-01', target: 'income', amount: 85_000, leaves: false}),
  due({ruleId: 'rent', title: 'Rent', day: '2026-12-01', amount: 18_000}),
];

it('still to pay: what leaves money in hand (expenses from it, a card bill, money put away), never money in or a charge to a card', () => {
  const still = stillToPay(upcoming);
  expect(still.total).toBe(649 + 420 * 3 + 5000 + 9000 + 18_000);
  expect(still.items.map(item => item.title)).not.toContain('Salary');
  expect(still.items.map(item => item.title)).toContain('Card bill');
  expect(still.items.map(item => item.title)).not.toContain('Prime on the card');
  // A bill whose amount varies is named, never guessed.
  expect(still.varies).toEqual(['Electricity']);
});

it('bills in a budget are the recurring expenses only: a transfer is not spending', () => {
  // A recurring expense is spending whatever pays it, so the one charged to the card counts too.
  expect(billsInBudget(upcoming)).toBe(649 + 420 * 3 + 299 + 18_000);
  expect(billsInBudget([])).toBe(0);
});

it('sums exactly (no float drift)', () => {
  expect(stillToPay([due({amount: 0.1}), due({amount: 0.2})]).total).toBe(0.3);
  expect(lessOf(0.3, 0.1)).toBe(0.2);
});

const accounts = [
  {type: 'cash' as const, balance: 4200, anchorDate: null, active: true},
  {type: 'bank' as const, balance: 182_450, anchorDate: '2026-11-01', active: true},
  {type: 'card' as const, balance: -49_256, anchorDate: '2026-10-20', active: true},
  {type: 'investment' as const, balance: 434_118, anchorDate: '2026-09-01', active: true},
  {type: 'wallet' as const, balance: 0, anchorDate: '2026-01-01', active: false},
];

it('in hand is the spend accounts only: what is owed on a card or a loan is not taken off it', () => {
  expect(toSpendOf(accounts)).toBe(186_650);
  expect(toSpendOf([...accounts, {type: 'loan' as const, balance: -300_000}])).toBe(186_650);
  expect(toSpendOf([{type: 'bank' as const, balance: -200}])).toBe(-200);
  expect(lessOf(toSpendOf(accounts), 34_859)).toBe(151_791);
});

it('the statement is as old as its stalest spendable balance set by hand', () => {
  // The bank's: not the card's or the investment's (neither is money in hand), nor the archived wallet's.
  expect(oldestCheckOf(accounts)).toBe('2026-11-01');
  expect(oldestCheckOf([{type: 'cash', anchorDate: null, active: true}])).toBeNull();
});

it('folds a rule that comes several times into one line with its sum', () => {
  const folded = foldByRule(stillToPay(upcoming).items);
  const milk = folded.find(item => item.ruleId === 'milk');
  expect(milk).toMatchObject({day: '2026-11-16', more: 2, sum: 1260});
  expect(folded.find(item => item.ruleId === 'power')).toMatchObject({more: 0, sum: null});
  expect(folded.map(item => item.ruleId)).toEqual(['netflix', 'milk', 'power', 'sip', 'card', 'rent']);
});
