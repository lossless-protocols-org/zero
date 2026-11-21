/** Test-only: a rule on the accounts seed (harness/accountsSeed), for the recurring screens' suites. */
import {createRule, type RuleFields} from '../../src/data/services/recurringService';
import type {AccountsSeed} from './accountsSeed';

export const seedRule = (seed: AccountsSeed, more: Partial<RuleFields> = {}, today = '2026-11-01'): Promise<string> =>
  createRule(
    seed.userId,
    {
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
    },
    today as Parameters<typeof createRule>[2], // the suites' days are written as YYYY-MM-DD
  );
