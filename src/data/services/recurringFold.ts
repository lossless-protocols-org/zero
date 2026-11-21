import {Q} from '@nozbe/watermelondb';
import {database} from '../database/database';
import type {RecurringRule} from '../database/models/RecurringRule';
import type {Expense} from '../database/models/Expense';
import type {Income} from '../database/models/Income';
import type {Transfer} from '../database/models/Transfer';
import type {ProDataPart} from './proDataService';

/**
 * Recurring rules as Pro data kept (law L9, ZERO_3.0_ENTITLEMENT.md §4): a
 * free user sees no rule, and none runs (the materialiser producer). The
 * entries rules already made are ordinary rows and stay; removal deletes the
 * rules and takes the link to them off those rows, in the same batch.
 */
export const recurringRulesPart: ProDataPart = {
  key: 'recurring',
  count: () => database.get<RecurringRule>('recurring_rules').query().fetchCount(),
  planRemoval: async plan => {
    const linked = [Q.where('recurring_id', Q.notEq(null))];
    const [rules, expenses, incomes, transfers] = await Promise.all([
      database.get<RecurringRule>('recurring_rules').query().fetch(),
      database
        .get<Expense>('expenses')
        .query(...linked)
        .fetch(),
      database
        .get<Income>('incomes')
        .query(...linked)
        .fetch(),
      database
        .get<Transfer>('transfers')
        .query(...linked)
        .fetch(),
    ]);
    for (const row of [...expenses, ...incomes, ...transfers]) {
      plan.update(row, unlinked => {
        unlinked.recurringId = null;
      });
    }
    rules.forEach(rule => plan.destroy(rule));
  },
};
