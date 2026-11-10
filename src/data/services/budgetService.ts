import {Q} from '@nozbe/watermelondb';
import {database} from '../database/database';
import {Budget} from '../database/models/Budget';
import {assertUserId} from './assertUserId';
import {isUsersCategoryOfKind} from './categoryKind';
import {toMoneyUnits} from '../../domain/money';
import {RECURRING_PREFIX, budgetAppliesTo, encodeBudgetMonth, parseBudgetMonth} from '../../domain/budgetMath';
import type {BudgetData, BudgetMonthKey, BudgetScope} from '../../domain/types';

const MONTHLY_SCOPE: BudgetScope = {budgetType: 'monthly'};

/** The rule a budget write broke. The budget sheet validates first; this is the backstop (audit 2026-11-08 §4.3). */
type BudgetRule = 'amountNotPositive' | 'notAnExpenseCategory';

class BudgetRuleError extends Error {
  readonly rule: BudgetRule;
  constructor(rule: BudgetRule) {
    super(`Budget rule broken: ${rule}`);
    this.name = 'BudgetRuleError';
    this.rule = rule;
  }
}

const scopeClauses = (userId: string, scope: BudgetScope) => [
  Q.where('user_id', userId),
  Q.where('budget_type', scope.budgetType),
  ...(scope.budgetType === 'category' ? [Q.where('category_id', scope.categoryId)] : []),
];

/** The row's scope, or null for a type no screen shows (an imported 'weekly', a category row with no id). */
const scopeOf = (b: Budget): BudgetScope | null => {
  if (b.budgetType === 'monthly') {
    return MONTHLY_SCOPE;
  }
  if (b.budgetType === 'category' && b.categoryId) {
    return {budgetType: 'category', categoryId: b.categoryId};
  }
  return null;
};

const toData = (b: Budget): BudgetData | null => {
  const scope = scopeOf(b);
  return scope && {id: b.id, userId: b.userId, amount: b.amount, monthKey: parseBudgetMonth(b.month), ...scope};
};

/**
 * Creates or updates ONE budget row, identified by its exact `month` key within
 * the scope.
 *
 * `month` uses one of three forms (resolution rules live in domain/budgetMath):
 *   - `'2026-07'`             — that month only.
 *   - `'recurring:2026-07'`   — July 2026 and every month after, until a later
 *                               recurring row takes over.
 *   - `'recurring'`           — legacy, pre-start-month form; never written.
 *
 * Matching on the EXACT key is the fix for the pre-2.7.0 bug where saving a
 * recurring budget from October re-pointed the single recurring row (and so
 * erased the amount July–September had been using). Now October gets its own
 * `recurring:2026-10` row and the July row keeps serving the earlier months.
 */
export const upsertBudget = async (
  userId: string,
  amount: number,
  monthKey: BudgetMonthKey,
  scope: BudgetScope = MONTHLY_SCOPE,
): Promise<string> => {
  assertUserId(userId, 'budget');
  // Zero is "no budget here", which clearBudgetForMonth writes on purpose; a set budget is above zero.
  if (!Number.isFinite(amount) || toMoneyUnits(amount) <= 0) {
    throw new BudgetRuleError('amountNotPositive');
  }
  const month = encodeBudgetMonth(monthKey);
  let budgetId = '';

  await database.write(async () => {
    // A category budget limits spending, so only one of the user's expense categories can have one.
    if (scope.budgetType === 'category' && !(await isUsersCategoryOfKind(userId, scope.categoryId, 'expense'))) {
      throw new BudgetRuleError('notAnExpenseCategory');
    }
    const [existing] = await database
      .get<Budget>('budgets')
      .query(...scopeClauses(userId, scope), Q.where('month', month))
      .fetch();

    if (existing) {
      await existing.update(b => {
        b.amount = amount;
      });
      budgetId = existing.id;
    } else {
      const budget = await database.get<Budget>('budgets').create(b => {
        b.userId = userId;
        b.categoryId = scope.budgetType === 'category' ? scope.categoryId : '';
        b.amount = amount;
        b.month = month;
        b.budgetType = scope.budgetType;
      });
      budgetId = budget.id;
    }
  });
  return budgetId;
};

/**
 * Removes the budget for ONE month and leaves every other month as it was.
 * A month-specific row is deleted outright. If a recurring row still covers
 * the month, a 0-amount month row is written instead: resolveBudget reads
 * that as "no budget here" while the recurring budget keeps serving the
 * months around it.
 */
export const clearBudgetForMonth = async (
  userId: string,
  yearMonth: string,
  scope: BudgetScope = MONTHLY_SCOPE,
): Promise<void> => {
  await database.write(async () => {
    const rows = await database
      .get<Budget>('budgets')
      .query(...scopeClauses(userId, scope))
      .fetch();
    const applicable = rows.filter(r => budgetAppliesTo(parseBudgetMonth(r.month), yearMonth));
    const specific = applicable.filter(r => parseBudgetMonth(r.month).kind === 'month');
    const coveredByRecurring = applicable.some(r => parseBudgetMonth(r.month).kind === 'recurring');

    const ops = specific.map(r => r.prepareDestroyPermanently());
    if (coveredByRecurring) {
      ops.push(
        database.get<Budget>('budgets').prepareCreate(b => {
          b.userId = userId;
          b.categoryId = scope.budgetType === 'category' ? scope.categoryId : '';
          b.amount = 0;
          b.month = yearMonth;
          b.budgetType = scope.budgetType;
        }),
      );
    }
    if (ops.length > 0) {
      await database.batch(...ops);
    }
  });
};

/**
 * Ends a recurring budget from `yearMonth` onward. Earlier months keep what
 * they had; the month itself and everything after have no budget until the
 * user sets one again. Rows that only concerned later months (a month override
 * or a recurring row starting later) are removed too, since the user asked
 * for "every month from here".
 */
export const stopRecurringBudgetFrom = async (
  userId: string,
  yearMonth: string,
  scope: BudgetScope = MONTHLY_SCOPE,
): Promise<void> => {
  await database.write(async () => {
    const rows = await database
      .get<Budget>('budgets')
      .query(...scopeClauses(userId, scope))
      .fetch();
    const toDestroy = rows.filter(r => {
      const key = parseBudgetMonth(r.month);
      return key.kind === 'recurring' ? key.start >= yearMonth : key.yearMonth >= yearMonth;
    });
    const stillCovering = rows.some(r => {
      const key = parseBudgetMonth(r.month);
      return key.kind === 'recurring' && key.start < yearMonth && r.amount > 0;
    });

    const ops = toDestroy.map(r => r.prepareDestroyPermanently());
    if (stillCovering) {
      ops.push(
        database.get<Budget>('budgets').prepareCreate(b => {
          b.userId = userId;
          b.categoryId = scope.budgetType === 'category' ? scope.categoryId : '';
          b.amount = 0;
          b.month = encodeBudgetMonth({kind: 'recurring', start: yearMonth});
          b.budgetType = scope.budgetType;
        }),
      );
    }
    if (ops.length > 0) {
      await database.batch(...ops);
    }
  });
};

/**
 * Every budget row (all types) that can apply to `yearMonth`: the month's own
 * rows plus every recurring row whose start is not after it. Picking the one in
 * force is resolveBudget's job (redux selectors), not this query's.
 */
export const getBudgetsByMonth = async (userId: string, yearMonth: string): Promise<BudgetData[]> => {
  const budgets = await database
    .get<Budget>('budgets')
    .query(
      Q.where('user_id', userId),
      Q.or(
        Q.where('month', yearMonth),
        Q.where('month', encodeBudgetMonth({kind: 'recurring', start: ''})),
        Q.where('month', Q.like(`${RECURRING_PREFIX}%`)),
      ),
    )
    .fetch();

  return budgets.flatMap(b => {
    const data = toData(b);
    return data && budgetAppliesTo(data.monthKey, yearMonth) ? [data] : [];
  });
};

/**
 * Deletes the month-specific row for `yearMonth` in the scope — an explicit
 * override or a 0-amount tombstone — without touching recurring rows. Used
 * after a recurring save so that month is served by the new recurring row.
 */
export const deleteMonthOverride = async (
  userId: string,
  yearMonth: string,
  scope: BudgetScope = MONTHLY_SCOPE,
): Promise<void> => {
  await database.write(async () => {
    const rows = await database
      .get<Budget>('budgets')
      .query(...scopeClauses(userId, scope), Q.where('month', yearMonth))
      .fetch();
    if (rows.length > 0) {
      await database.batch(...rows.map(r => r.prepareDestroyPermanently()));
    }
  });
};
