/** Recurring rules as Pro data kept (L9): counted; removal deletes them and unlinks what they made, which stays. */
import {database} from '../../../../src/data/database/database';
import {createRule, materialiseDue} from '../../../../src/data/services/recurringService';
import {recurringRulesPart} from '../../../../src/data/services/recurringFold';
import {removeProData} from '../../../../src/data/services/proDataService';
import {seedAccounts} from '../../../harness/accountsSeed';

it('counts the rules; removing them keeps every entry they made, unlinked', async () => {
  const seed = await seedAccounts();
  expect(await recurringRulesPart.count()).toBe(0);
  await createRule(
    seed.userId,
    {
      target: 'expense',
      title: 'Rent',
      categoryId: seed.snacks,
      accountId: seed.bank,
      toAccountId: null,
      amount: 100,
      cadence: 'monthly',
      interval: 1,
      startDate: '2026-11-01',
      endDate: null,
      remindDaysBefore: null,
    },
    '2026-11-01',
  );
  await materialiseDue(seed.userId, '2026-11-01');
  expect(await recurringRulesPart.count()).toBe(1);
  await removeProData([recurringRulesPart]);
  expect(await database.get('recurring_rules').query().fetchCount()).toBe(0);
  const rows = (await database.get('expenses').query().unsafeFetchRaw()) as Array<Record<string, unknown>>;
  expect(rows.map(r => [r['title'], r['recurring_id']])).toEqual([['Rent', null]]);
});
