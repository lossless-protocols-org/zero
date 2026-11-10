/**
 * The widget snapshot (2.8 Phase 3): what the native widget is allowed to
 * show. The privacy rule is tested on the serialised JSON, because that is
 * what reaches the widget's storage.
 */
import {moneyFormatSpec} from '../../../../src/platform/moneyFormatSpec';
import {buildWidgetSnapshot, setupSnapshot, WIDGET_SNAPSHOT_VERSION} from '../../../../src/features/widgets/snapshot';

type WidgetFigures = Parameters<typeof buildWidgetSnapshot>[0];
type WidgetText = Parameters<typeof buildWidgetSnapshot>[1];

const money = (amount: number): string => `₹${amount.toLocaleString('en-IN')}`;

const text: WidgetText = {
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

const figures = (over: Partial<WidgetFigures> = {}): WidgetFigures => ({
  monthKey: '2026-11',
  todayKey: '2026-11-06',
  monthLabel: 'November',
  locale: 'en-IN',
  spentMonth: 45_029,
  spentToday: 120,
  received: 80_000,
  budget: 30_000,
  quick: [
    {id: 'c1', name: 'Food'},
    {id: 'c2', name: 'Transport'},
    {id: 'c3', name: 'Shopping'},
    {id: 'c4', name: 'Bills'},
    {id: 'c5', name: 'Health'},
  ],
  incomeCategoryId: 'cat_income',
  again: [
    {title: 'Chai', amount: 20, categoryId: 'c1'},
    {title: '', amount: 15, categoryId: 'c2'},
    {title: 'Gone', amount: 9, categoryId: 'archived'},
  ],
  last: {title: 'Chai', amount: 20, categoryId: 'c1'},
  money: moneyFormatSpec('INR', 'en-IN'),
  hideAmounts: false,
  now: 1_000,
  ...over,
});

describe('buildWidgetSnapshot', () => {
  it('offers "add again" entries as finished text, never an archived category', () => {
    const s = buildWidgetSnapshot(figures(), text);
    expect(s.again).toEqual([
      {title: 'Chai', categoryId: 'c1', categoryName: 'Food', amount: 20, amountText: '₹20'},
      {title: 'Transport', categoryId: 'c2', categoryName: 'Transport', amount: 15, amountText: '₹15'},
    ]);
    expect(s.last).toEqual({title: 'Chai', categoryId: 'c1', categoryName: 'Food', amount: 20, amountText: '₹20'});
  });

  it('leaves "add again" out with amounts hidden', () => {
    const s = buildWidgetSnapshot(figures({hideAmounts: true}), text);
    expect(s.again).toEqual([]);
    expect(s.last).toBeNull();
  });

  it('carries the figures as finished text', () => {
    const s = buildWidgetSnapshot(figures(), text);
    expect(s).toMatchObject({
      v: WIDGET_SNAPSHOT_VERSION,
      state: 'ready',
      monthKey: '2026-11',
      todayKey: '2026-11-06',
      monthLabel: 'November',
      spentMonth: '₹45,029',
      spentToday: '₹120',
      zero: '₹0',
      incomeLine: 'Received ₹80,000 · Kept ₹34,971',
      labels: {
        today: 'Today',
        addExpense: 'Add expense',
        addIncome: 'Money in',
        summary: 'November: ₹45,029 spent. Today: ₹120.',
      },
    });
  });

  it('shows what is left of the budget, and how far over it is', () => {
    expect(buildWidgetSnapshot(figures({spentMonth: 7_500, budget: 30_000}), text).budget).toEqual({
      progress: 0.25,
      over: false,
      text: '₹22,500 left',
    });
    expect(buildWidgetSnapshot(figures(), text).budget).toEqual({
      progress: 1,
      over: true,
      text: '₹15,029 over budget',
    });
  });

  it('keeps the bar in 0..1 when refunds make the month negative', () => {
    const s = buildWidgetSnapshot(figures({spentMonth: -500, spentToday: -500}), text);
    expect(s.budget?.progress).toBe(0);
    expect(s.spentMonth).toBe('₹500 back');
    expect(s.spentToday).toBe('₹500 back');
  });

  it('has no budget line without a budget (or with a zero one)', () => {
    expect(buildWidgetSnapshot(figures({budget: null}), text).budget).toBeNull();
    expect(buildWidgetSnapshot(figures({budget: 0}), text).budget).toBeNull();
  });

  it('has no money-in line before money comes in, and says when spending passed it', () => {
    expect(buildWidgetSnapshot(figures({received: 0}), text).incomeLine).toBeNull();
    expect(buildWidgetSnapshot(figures({received: 40_000}), text).incomeLine).toBe('Received ₹40,000 · ₹5,029 over');
  });

  it('with amounts hidden, writes no amount anywhere the widget stores, and no budget bar', () => {
    const s = buildWidgetSnapshot(figures({hideAmounts: true}), text);
    expect(s.spentMonth).toBe('••••');
    expect(s.spentToday).toBe('••••');
    expect(s.zero).toBe('••••');
    expect(s.budget).toBeNull();
    expect(s.incomeLine).toBe('Received •••• · Kept ••••');
    expect(s.live).toBeNull();
    expect(s.money).not.toBeNull(); // rules, not amounts: Siri still says how much was added
    const stored = JSON.stringify({...s, preview: null});
    for (const figure of ['45,029', '120', '80,000', '34,971', '30,000', '15,029']) {
      expect({figure, stored: stored.includes(figure)}).toEqual({figure, stored: false});
    }
  });

  it('gives the picker preview made-up figures in the user money format, never theirs', () => {
    const s = buildWidgetSnapshot(figures({hideAmounts: true}), text);
    expect(s.preview).toEqual({spentMonth: '₹12,345', spentToday: '₹450', budgetText: '₹2,655 left'});
  });
});

it('offers at most four category chips, in the order given, names only', () => {
  const s = buildWidgetSnapshot(figures(), text);
  expect(s.quick).toEqual([
    {id: 'c1', name: 'Food'},
    {id: 'c2', name: 'Transport'},
    {id: 'c3', name: 'Shopping'},
    {id: 'c4', name: 'Bills'},
  ]);
  expect(buildWidgetSnapshot(figures({hideAmounts: true}), text).quick).toHaveLength(4);
});

it('hands the iOS side raw figures, money rules and templates only while amounts show', () => {
  const s = buildWidgetSnapshot(figures(), text);
  expect(s.live).toMatchObject({spentMonth: 45_029, spentToday: 120, received: 80_000, budget: 30_000});
  expect(s.live?.templates.left).toBe('%@ left');
  expect(s.money?.grouping).toEqual([3, 2]);
  expect(s.categories).toHaveLength(5);
  expect(s.incomeCategoryId).toBe('cat_income');
});

describe('setupSnapshot', () => {
  it('is a readable "open zero" state with no figures', () => {
    const s = setupSnapshot('en-IN', 5);
    expect(s).toMatchObject({v: WIDGET_SNAPSHOT_VERSION, state: 'setup', locale: 'en-IN', computedAt: 5});
    expect([s.spentMonth, s.spentToday, s.budget, s.incomeLine]).toEqual(['', '', null, null]);
  });
});
