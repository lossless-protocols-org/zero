import {budgetScopeOptions} from '../budgetScopes';
import {parseBudgetMonth} from '../budgetMath';

const budget = (amount: number, month: string) => ({amount, monthKey: parseBudgetMonth(month)});

describe('budgetScopeOptions (M12: one list for Reports and Settings)', () => {
  it('lists the overall budget first, then each active category with its own budget', () => {
    const scopes = budgetScopeOptions(
      'Overall',
      budget(500, 'recurring:2026-01'),
      [
        {id: 'c1', name: 'Food', icon: 'pizza', color: '#111111'},
        {id: 'c2', name: 'Fuel', icon: '', color: ''},
      ],
      {c1: budget(100, '2026-10')},
    );
    expect(scopes).toEqual([
      {categoryId: '', name: 'Overall', currentAmount: 500, isRecurring: true},
      {categoryId: 'c1', name: 'Food', icon: 'pizza', color: '#111111', currentAmount: 100, isRecurring: false},
      {categoryId: 'c2', name: 'Fuel', icon: undefined, color: undefined, currentAmount: undefined, isRecurring: false},
    ]);
  });

  it('has no amount for an overall scope with no budget set', () => {
    expect(budgetScopeOptions('Overall', null, [], {})).toEqual([
      {categoryId: '', name: 'Overall', currentAmount: undefined, isRecurring: false},
    ]);
  });
});
