/**
 * The widget's data contract (2.8): what src/features/widgets/snapshot.ts writes is
 * exactly what the Kotlin and Swift readers parse. All three are pinned to one
 * file, contracts/widget-snapshot-contract.json: this test fails if the JS
 * builder drifts from it, WidgetSnapshotTest.kt (JUnit) if the Kotlin reader
 * cannot read it, and WidgetSnapshotContractTests.swift (ios/ZeroShared) if
 * the Swift reader cannot. A deliberate format change:
 *   ZERO_UPDATE_WIDGET_CONTRACT=1 bunx jest __tests__/widgetContract.test.ts
 * then bump WIDGET_SNAPSHOT_VERSION if old readers would misread it.
 */
import {moneyFormatSpec} from '../../src/platform/moneyFormatSpec';
import {buildWidgetSnapshot, setupSnapshot} from '../../src/features/widgets/snapshot';
import fs from 'node:fs';
import {fromRoot} from '../harness/paths';

const FILE = fromRoot('contracts', 'widget-snapshot-contract.json');

type Figures = Parameters<typeof buildWidgetSnapshot>[0];
type Text = Parameters<typeof buildWidgetSnapshot>[1];

const money = (amount: number): string => `₹${amount.toLocaleString('en-IN')}`;
const text: Text = {
  money,
  spend: amount => (amount < 0 ? `${money(-amount)} back` : money(amount)),
  today: 'Today',
  addExpense: 'Add expense',
  addIncome: 'Money in',
  hidden: '••••',
  left: amount => `${amount} left`,
  over: amount => `${amount} over budget`,
  incomeLine: (received, kept, keptText) =>
    kept >= 0 ? `Received ${received} · Kept ${keptText}` : `Received ${received} · ${keptText} over`,
  summary: (month, spent, today) => `${month}: ${spent} spent. Today: ${today}.`,
  templates: {
    left: '%@ left',
    over: '%@ over budget',
    back: '%@ back',
    received: 'Received %1$@ · Kept %2$@',
    overReceived: 'Received %1$@ · %2$@ over',
    summary: '%1$@: %2$@ spent. Today: %3$@.',
  },
};
const figures: Figures = {
  monthKey: '2026-11',
  todayKey: '2026-11-06',
  monthLabel: 'November',
  locale: 'en-IN',
  spentMonth: 45_029,
  spentToday: 120,
  received: 80_000,
  budget: 30_000,
  quick: [
    {id: 'cat_food', name: 'Food'},
    {id: 'cat_grocery', name: 'Grocery'},
  ],
  incomeCategoryId: 'cat_income',
  again: [{title: 'Chai', amount: 20, categoryId: 'cat_food'}],
  last: {title: 'Chai', amount: 20, categoryId: 'cat_food'},
  money: moneyFormatSpec('INR', 'en-IN'),
  hideAmounts: false,
  now: 1_793_980_000_000,
};

const contract = {
  ready: buildWidgetSnapshot(figures, text),
  hidden: buildWidgetSnapshot({...figures, hideAmounts: true}, text),
  underBudget: buildWidgetSnapshot({...figures, spentMonth: 7_500, received: 0, quick: []}, text),
  setup: setupSnapshot('en-IN', 1_793_980_000_000),
};

it('the JS snapshot builder writes exactly the pinned contract the Kotlin reader is tested against', () => {
  const json = `${JSON.stringify(contract, null, 2)}\n`;
  if (process.env['ZERO_UPDATE_WIDGET_CONTRACT'] === '1') {
    fs.writeFileSync(FILE, json);
  }
  expect(fs.readFileSync(FILE, 'utf8')).toBe(json);
});
