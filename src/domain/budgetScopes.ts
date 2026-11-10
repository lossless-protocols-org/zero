import type {BudgetMonthKey} from './types';

/** The overall budget first, then categories: never empty, so the first scope always exists. */
export type BudgetScopeList = [BudgetScopeOption, ...BudgetScopeOption[]];

/** One thing a budget can be set for: the whole month ('' id) or a category. */
export interface BudgetScopeOption {
  /** '' for the overall monthly budget. */
  categoryId: string;
  name: string;
  icon?: string;
  color?: string;
  currentAmount?: number;
  isRecurring: boolean;
}

interface BudgetLike {
  amount: number;
  monthKey: BudgetMonthKey;
}

interface CategoryLike {
  id: string;
  name: string;
  icon: string;
  color: string;
}

/** The budget sheet's scope list: the overall budget, then every active category. */
export const budgetScopeOptions = (
  overallName: string,
  overall: BudgetLike | null,
  categories: readonly CategoryLike[],
  budgetsByCategory: Readonly<Record<string, BudgetLike>>,
): BudgetScopeList => [
  {
    categoryId: '',
    name: overallName,
    currentAmount: overall?.amount,
    isRecurring: overall?.monthKey.kind === 'recurring',
  },
  ...categories.map(category => {
    const budget = budgetsByCategory[category.id];
    return {
      categoryId: category.id,
      name: category.name,
      icon: category.icon || undefined,
      color: category.color || undefined,
      currentAmount: budget?.amount,
      isRecurring: budget?.monthKey.kind === 'recurring',
    };
  }),
];
