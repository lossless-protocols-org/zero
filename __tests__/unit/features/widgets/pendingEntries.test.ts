/**
 * Entries made outside the app (2.8, iOS) are saved by the app through the
 * normal services, once each, with the queue told exactly what was saved.
 *
 * Tickets: audit 2026-11-08 §3.4.
 */
import {database} from '../../../../src/data/database/database';
import * as services from '../../../harness/services';
import {applyPendingEntries, parsePendingEntries} from '../../../../src/features/widgets/pendingEntries';

let mockQueue = '[]';
const mockRemove = jest.fn<void, [string[]]>();
// The iOS queue's module; the widget bridge stays absent (no widget to redraw here).
jest.mock('../../../../src/native/specs/NativePendingEntries', () => ({
  __esModule: true,
  default: {
    readPendingEntries: () => Promise.resolve(mockQueue),
    removePendingEntries: (ids: string[]) => mockRemove(ids),
  },
}));
import type {Category} from '../../../../src/data/database/models/Category';
import * as categories from '../../../../src/data/services/categoryService';

type Raw = Partial<Record<'id' | 'title' | 'amount' | 'category_id' | 'date' | 'note', unknown>>;
const rows = (table: string): Promise<Raw[]> => database.get(table).query().unsafeFetchRaw();

const seed = async () => {
  await services.deleteAllData();
  const userId = await services.createUser('Ravi', '');
  await services.createCurrency('INR', '₹', 'Indian Rupee', userId);
  const food = await services.createCategory('Food', userId, 'pizza', '#111111', 'expense');
  const gone = await services.createCategory('Gone', userId, 'x', '#222222', 'expense');
  await services.softDeleteCategoryById(gone);
  return {food, gone};
};

beforeEach(() => {
  mockRemove.mockClear();
});

it('saves expenses and money in once, falls back from a deleted category, drops what cannot be saved', async () => {
  const {food, gone} = await seed();
  mockQueue = JSON.stringify([
    {id: 'q1', kind: 'expense', amount: 120, categoryId: food, title: 'Chai', date: '2026-11-06T09:15:00'},
    {id: 'q2', kind: 'expense', amount: 80, categoryId: gone, title: '', date: '2026-11-06T10:00:00'},
    {id: 'q3', kind: 'income', amount: 5000, categoryId: 'unknown', title: 'Gift', date: '2026-11-06T11:00:00'},
    {id: 'q4', kind: 'expense', amount: 1e15, categoryId: food, title: 'Too much', date: '2026-11-06T12:00:00'},
    {id: 'q5', kind: 'expense', amount: -3, categoryId: food, title: 'Negative', date: '2026-11-06T12:00:00'},
  ]);

  // The months written, for the app shell to refresh (this module never touches the store).
  expect(await applyPendingEntries()).toEqual(['2026-11']);
  const expenses = await rows('expenses');
  expect(expenses.map(e => [e.id, e.title, Number(e.amount), e.category_id]).sort()).toEqual([
    ['q1', 'Chai', 120, food],
    ['q2', 'Food', 80, food], // deleted category → the first active one, titled with its name
  ]);
  const incomes = await rows('incomes');
  expect(incomes.map(i => [i.id, Number(i.amount), i.date, i.note])).toEqual([['q3', 5000, '2026-11-06', 'Gift']]);
  // q4 is beyond what the currency allows: dropped (logged). q5 never parsed.
  // Each leaves the queue as soon as it is settled, one call each (audit §3.4).
  expect(mockRemove.mock.calls).toEqual([[['q1']], [['q2']], [['q3']], [['q4']]]);

  // The queue was not cleared (say the app died first): replaying saves nothing twice.
  await applyPendingEntries();
  expect(await rows('expenses')).toHaveLength(2);
  expect(await rows('incomes')).toHaveLength(1);
});

it('an expense with nowhere to go is dropped; money in waits for the income category repair', async () => {
  const {food} = await seed();
  // Every category archived, the income one included (no screen can do this: the services refuse it).
  await database.write(async () => {
    const all = await database.get<Category>('categories').query().fetch();
    await database.batch(
      ...all.map(c =>
        c.prepareUpdate(row => {
          row.categoryStatus = false;
        }),
      ),
    );
  });
  mockQueue = JSON.stringify([
    {id: 'q6', kind: 'expense', amount: 10, categoryId: food, title: 'Tea', date: '2026-11-06T09:00:00'},
    {id: 'q7', kind: 'income', amount: 20, categoryId: 'x', title: '', date: '2026-11-06T09:00:00'},
  ]);
  await applyPendingEntries();
  // The expense can never land (the user archived every expense category): dropped, so it stops
  // inflating the widget. The money in is kept: the repair below gives it somewhere to land.
  expect(mockRemove.mock.calls).toEqual([[['q6']]]);
  expect(await rows('incomes')).toEqual([]);

  const [user] = await services.getAllUsers();
  expect(await categories.ensureIncomeCategory(String(user?.id))).toBe(true); // what bootstrapSession runs
  mockQueue = JSON.stringify([
    {id: 'q7', kind: 'income', amount: 20, categoryId: 'x', title: '', date: '2026-11-06T09:00:00'},
  ]);
  await applyPendingEntries();
  expect((await rows('incomes')).map(i => i.id)).toEqual(['q7']);
  expect(mockRemove.mock.calls).toEqual([[['q6']], [['q7']]]);
});

it('keeps everything queued before onboarding', async () => {
  await services.deleteAllData();
  mockQueue = JSON.stringify([
    {id: 'q9', kind: 'expense', amount: 10, categoryId: 'x', title: '', date: '2026-11-06T09:00:00'},
  ]);
  await applyPendingEntries();
  expect(mockRemove).not.toHaveBeenCalled();
});

it('reads only well-formed entries', () => {
  expect(parsePendingEntries('not json')).toEqual([]);
  expect(parsePendingEntries('{"id":1}')).toEqual([]);
  expect(
    parsePendingEntries(
      JSON.stringify([
        {id: 'a', kind: 'expense', amount: 1, categoryId: 'c', title: '', date: '2026-11-06T09:00:00'},
        {id: 'b', kind: 'gift', amount: 1, categoryId: 'c', title: '', date: '2026-11-06T09:00:00'},
        {id: 'c', kind: 'expense', amount: 1, categoryId: 'c', title: '', date: '6 Nov'},
      ]),
    ).map(e => e.id),
  ).toEqual(['a']);
});
