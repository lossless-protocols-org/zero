/**
 * Recurring rules (plan P9): a run makes at most one occurrence per rule and
 * any number of runs make it once; a rule more than one behind is asked
 * about, not filled; a rule whose amount varies waits to be confirmed; a rule
 * whose category or account went away waits, paused, and is never repaired;
 * deleting a rule keeps what it made. Real LokiJS database.
 */
import {Q} from '@nozbe/watermelondb';
import {database} from '../../../../src/data/database/database';
import {
  RecurringRuleError,
  catchUp,
  confirmOccurrence,
  createRule,
  deleteRule,
  getRuleById,
  getRules,
  getDueThrough,
  getUpcoming,
  materialiseDue,
  setRulePaused,
  skipOccurrence,
  startFromToday,
  updateRule,
  type RuleFields,
} from '../../../../src/data/services/recurringService';
import {setAccountArchived} from '../../../../src/data/services/accountService';
import {defaultIncomeCategoryId} from '../../../../src/data/database/defaultIncomeCategory';
import {seedAccounts, type AccountsSeed} from '../../../harness/accountsSeed';
import * as services from '../../../harness/services';
import type {IsoDay} from '../../../../src/domain/types';

let seed: AccountsSeed;
beforeEach(async () => {
  seed = await seedAccounts();
});

const rent = (more: Partial<RuleFields> = {}): RuleFields => ({
  target: 'expense',
  title: 'Rent',
  categoryId: seed.snacks,
  accountId: seed.bank,
  toAccountId: null,
  amount: 18000,
  cadence: 'monthly',
  interval: 1,
  startDate: '2026-11-01',
  endDate: null,
  remindDaysBefore: null,
  ...more,
});
const raw = async (table: string) =>
  (await database.get(table).query().unsafeFetchRaw()) as Array<Record<string, unknown>>;
const ruleError = (write: Promise<unknown>) =>
  write.then(
    () => 'accepted',
    (error: unknown) => (error instanceof RecurringRuleError ? error.rule : String(error)),
  );
const d = (day: string) => day as IsoDay; // the tests' days are written as YYYY-MM-DD

describe('the write path', () => {
  it('starts at the first occurrence on or after today: no entries for days before it was set up', async () => {
    const id = await createRule(seed.userId, rent({startDate: '2026-08-01'}), d('2026-11-11'));
    expect(await getRuleById(id)).toMatchObject({nextRun: '2026-12-01', nextIndex: 4, status: 'active'});
  });

  it('refuses what cannot run', async () => {
    const today = d('2026-11-11');
    expect(await ruleError(createRule(seed.userId, rent({title: ' '}), today))).toBe('titleNotValid');
    expect(await ruleError(createRule(seed.userId, rent({amount: 0}), today))).toBe('amountNotValid');
    expect(await ruleError(createRule(seed.userId, rent({interval: 0}), today))).toBe('notAnInterval');
    expect(await ruleError(createRule(seed.userId, rent({startDate: '2026-02-30'}), today))).toBe('notADay');
    expect(await ruleError(createRule(seed.userId, rent({endDate: '2026-10-01'}), today))).toBe('endBeforeStart');
    expect(await ruleError(createRule(seed.userId, rent({remindDaysBefore: 31}), today))).toBe('notAReminder');
    expect(
      await ruleError(createRule(seed.userId, rent({categoryId: defaultIncomeCategoryId(seed.userId)}), today)),
    ).toBe('notACategory');
    expect(
      await ruleError(
        createRule(seed.userId, rent({target: 'transfer', categoryId: '', toAccountId: seed.bank}), today),
      ),
    ).toBe('sameAccount');
    expect(await getRules(seed.userId)).toEqual([]);
  });

  it('an edit changes only what it names; a new schedule starts again from today', async () => {
    const id = await createRule(seed.userId, rent(), d('2026-11-01'));
    await updateRule(id, {amount: 19000}, d('2026-11-20'));
    expect(await getRuleById(id)).toMatchObject({amount: 19000, nextRun: '2026-11-01', title: 'Rent'});
    await updateRule(id, {startDate: '2026-11-05'}, d('2026-11-20'));
    expect(await getRuleById(id)).toMatchObject({nextRun: '2026-12-05'});
  });
});

describe('materialiseDue', () => {
  it('makes the one due occurrence on its rule’s account, and any number of runs make it once', async () => {
    const id = await createRule(seed.userId, rent(), d('2026-11-01'));
    expect(await materialiseDue(seed.userId, d('2026-11-01'))).toEqual({written: 1, behind: [], asks: []});
    expect(await materialiseDue(seed.userId, d('2026-11-01'))).toEqual({written: 0, behind: [], asks: []});
    const made = (await raw('expenses')).filter(e => e['recurring_id'] === id);
    expect(made).toEqual([
      expect.objectContaining({title: 'Rent', amount: 18000, date: '2026-11-01T09:00:00', account_id: seed.bank}),
    ]);
    expect(await getRuleById(id)).toMatchObject({nextRun: '2026-12-01'});
  });

  it('a row already there for the day is not made again, and the rule still moves on (a crash between the two)', async () => {
    const id = await createRule(seed.userId, rent(), d('2026-11-01'));
    await database.write(async () => {
      await database.get('expenses').create(e => {
        Object.assign(e._raw, {
          user_id: seed.userId,
          title: 'Rent',
          amount: 18000,
          description: '',
          category_id: seed.snacks,
          date: '2026-11-01T09:00:00',
          account_id: seed.bank,
          recurring_id: id,
        });
      });
    });
    expect((await materialiseDue(seed.userId, d('2026-11-01'))).written).toBe(0);
    expect((await raw('expenses')).filter(e => e['recurring_id'] === id)).toHaveLength(1);
    expect(await getRuleById(id)).toMatchObject({nextRun: '2026-12-01'});
  });

  it('a rule more than one behind is asked about, not filled', async () => {
    const id = await createRule(seed.userId, rent(), d('2026-11-01'));
    expect(await materialiseDue(seed.userId, d('2027-02-15'))).toEqual({
      written: 0,
      behind: [{ruleId: id, title: 'Rent', missed: 4}],
      asks: [],
    });
    expect(await raw('expenses')).toEqual([]);
  });

  it('"add the missed entries" makes each, once; "start from today" skips them', async () => {
    const id = await createRule(seed.userId, rent(), d('2026-11-01'));
    expect(await catchUp(id, d('2027-02-15'))).toBe(4);
    expect(await catchUp(id, d('2027-02-15'))).toBe(0);
    expect((await raw('expenses')).map(e => String(e['date']).slice(0, 10)).sort()).toEqual([
      '2026-11-01',
      '2026-12-01',
      '2027-01-01',
      '2027-02-01',
    ]);
    const other = await createRule(seed.userId, rent({title: 'Gym', startDate: '2026-11-03'}), d('2026-11-01'));
    await startFromToday(other, d('2027-02-03'));
    expect(await getRuleById(other)).toMatchObject({nextRun: '2027-02-03'});
    expect((await materialiseDue(seed.userId, d('2027-02-03'))).written).toBe(1);
  });

  it('a rule whose amount varies waits to be confirmed, or skipped', async () => {
    const id = await createRule(seed.userId, rent({title: 'Electricity', amount: null}), d('2026-11-01'));
    const {asks} = await materialiseDue(seed.userId, d('2026-11-01'));
    expect(asks).toEqual([{ruleId: id, index: 0, day: '2026-11-01', target: 'expense', title: 'Electricity'}]);
    expect(await raw('expenses')).toEqual([]);
    await confirmOccurrence(id, 0, 1234.5);
    // A stale screen: the occurrence was already confirmed. Refused, so it cannot report an entry made.
    expect(await ruleError(confirmOccurrence(id, 0, 99))).toBe('notWaiting');
    expect(await ruleError(skipOccurrence(id, 5))).toBe('notWaiting');
    expect((await raw('expenses')).map(e => e['amount'])).toEqual([1234.5]);
    await skipOccurrence(id, 1);
    expect(await getRuleById(id)).toMatchObject({nextIndex: 2, nextRun: '2027-01-01'});
    await expect(confirmOccurrence(id, 2, 0)).rejects.toBeInstanceOf(RecurringRuleError);
  });

  it('money in and transfers are made too, by day, with the rule’s note', async () => {
    const salary = await createRule(
      seed.userId,
      rent({target: 'income', title: 'Salary', categoryId: defaultIncomeCategoryId(seed.userId), amount: 50000}),
      d('2026-11-01'),
    );
    const sip = await createRule(
      seed.userId,
      rent({target: 'transfer', title: 'SIP', categoryId: '', toAccountId: seed.fund, amount: 5000}),
      d('2026-11-01'),
    );
    expect((await materialiseDue(seed.userId, d('2026-11-01'))).written).toBe(2);
    expect(await raw('incomes')).toEqual([
      expect.objectContaining({note: 'Salary', amount: 50000, date: '2026-11-01', recurring_id: salary}),
    ]);
    expect(await raw('transfers')).toEqual([
      expect.objectContaining({note: 'SIP', from_account_id: seed.bank, to_account_id: seed.fund, recurring_id: sip}),
    ]);
  });

  it('a paused rule, or one whose account was archived, makes nothing and says why', async () => {
    const paused = await createRule(seed.userId, rent(), d('2026-11-01'));
    await setRulePaused(paused, true);
    const waiting = await createRule(seed.userId, rent({title: 'Card', accountId: seed.card}), d('2026-11-01'));
    await setAccountArchived(seed.card, true);
    expect((await materialiseDue(seed.userId, d('2026-11-01'))).written).toBe(0);
    expect((await getRuleById(paused))?.status).toBe('paused');
    expect((await getRuleById(waiting))?.status).toBe('needsAccount');
    // Resumed later: what it missed is asked about, not made silently.
    await setRulePaused(paused, false);
    expect((await materialiseDue(seed.userId, d('2026-12-02'))).behind.map(b => b.ruleId)).toEqual([paused]);
  });

  it('a rule whose category was archived waits for a category, and saving it unchanged leaves it waiting', async () => {
    const id = await createRule(seed.userId, rent(), d('2026-11-01'));
    await services.softDeleteCategoryById(seed.snacks);
    expect((await getRuleById(id))?.status).toBe('needsCategory');
    await updateRule(id, {amount: 100}, d('2026-11-01'));
    expect((await materialiseDue(seed.userId, d('2026-11-01'))).written).toBe(0);
  });

  it('stops after its end date', async () => {
    const id = await createRule(seed.userId, rent({endDate: '2026-11-30'}), d('2026-11-01'));
    await materialiseDue(seed.userId, d('2026-11-01'));
    expect(await getRuleById(id)).toMatchObject({nextRun: null, status: 'ended'});
    expect((await materialiseDue(seed.userId, d('2027-01-01'))).written).toBe(0);
  });
});

describe('a rule that varies, behind', () => {
  it('is never offered as "add the missed entries": its oldest due occurrence waits to be confirmed', async () => {
    const id = await createRule(seed.userId, rent({title: 'Electricity', amount: null}), d('2026-11-01'));
    const {behind, asks} = await materialiseDue(seed.userId, d('2027-01-15'));
    expect(behind).toEqual([]);
    expect(asks).toEqual([{ruleId: id, index: 0, day: '2026-11-01', target: 'expense', title: 'Electricity'}]);
    await confirmOccurrence(id, 0, 10);
    expect((await materialiseDue(seed.userId, d('2027-01-15'))).asks.map(a => a.day)).toEqual(['2026-12-01']);
  });
});

describe('deleteRule and getUpcoming', () => {
  it('deleting a rule keeps what it made, as ordinary entries', async () => {
    const id = await createRule(seed.userId, rent(), d('2026-11-01'));
    await materialiseDue(seed.userId, d('2026-11-01'));
    await deleteRule(id);
    expect(await getRules(seed.userId)).toEqual([]);
    expect(await database.get('expenses').query(Q.where('title', 'Rent')).fetchCount()).toBe(1);
    expect((await raw('expenses')).map(e => e['recurring_id'])).toEqual([null]);
  });

  it('lists what is coming, soonest first; a paused rule has nothing coming', async () => {
    await createRule(seed.userId, rent({remindDaysBefore: 1}), d('2026-11-01'));
    const gym = await createRule(
      seed.userId,
      rent({title: 'Gym', amount: null, cadence: 'weekly', startDate: '2026-11-03'}),
      d('2026-11-01'),
    );
    expect((await getUpcoming(seed.userId, d('2026-11-01'), 10)).map(u => [u.title, u.day])).toEqual([
      ['Rent', '2026-11-01'],
      ['Gym', '2026-11-03'],
      ['Gym', '2026-11-10'],
    ]);
    await setRulePaused(gym, true);
    expect((await getUpcoming(seed.userId, d('2026-11-02'), 40)).map(u => u.day)).toEqual(['2026-12-01']);
  });
});

// UX revamp v2: what a month still holds, and which of it takes money out of what can be spent.
describe('getDueThrough', () => {
  it('lists what is still to come through a day, both ends included, and nothing for an empty stretch', async () => {
    await createRule(seed.userId, rent({startDate: '2026-11-20'}), d('2026-11-13'));
    await createRule(seed.userId, rent({title: 'Next month', startDate: '2026-12-01'}), d('2026-11-13'));
    const due = await getDueThrough(seed.userId, d('2026-11-13'), d('2026-11-30'));
    expect(due.map(u => [u.title, u.day])).toEqual([['Rent', '2026-11-20']]);
    expect((await getDueThrough(seed.userId, d('2026-11-20'), d('2026-11-20'))).map(u => u.title)).toEqual(['Rent']);
    expect(await getDueThrough(seed.userId, d('2026-11-21'), d('2026-11-20'))).toEqual([]);
  });

  it('what leaves money in hand: an expense from it, a card bill, money put away; never money in or a charge to the card', async () => {
    const transfer = (title: string, toAccountId: string) =>
      rent({target: 'transfer', title, categoryId: '', toAccountId, startDate: '2026-11-20'});
    await createRule(seed.userId, rent({startDate: '2026-11-20'}), d('2026-11-13'));
    await createRule(seed.userId, transfer('Card bill', seed.card), d('2026-11-13'));
    await createRule(seed.userId, transfer('SIP', seed.fund), d('2026-11-13'));
    await createRule(
      seed.userId,
      rent({title: 'Prime', accountId: seed.card, startDate: '2026-11-20'}),
      d('2026-11-13'),
    );
    await createRule(
      seed.userId,
      rent({
        target: 'income',
        title: 'Salary',
        categoryId: defaultIncomeCategoryId(seed.userId),
        startDate: '2026-11-20',
      }),
      d('2026-11-13'),
    );
    const due = await getDueThrough(seed.userId, d('2026-11-13'), d('2026-11-30'));
    expect(Object.fromEntries(due.map(u => [u.title, u.leaves]))).toEqual({
      Rent: true,
      // The card's debt is no longer taken off money in hand, so paying its bill leaves it (approved model A2).
      'Card bill': true,
      SIP: true,
      // Charged to the card: money in hand changes only when the bill is paid.
      Prime: false,
      Salary: false,
    });
    // Only the bill pays down what is owed: the Debts tab's "next due".
    expect(due.filter(u => u.paysDebt).map(u => u.title)).toEqual(['Card bill']);
  });
});
