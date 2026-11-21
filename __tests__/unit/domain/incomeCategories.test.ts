/** The income category money lands in: the first active one in the user's order. */
import {primaryIncomeCategory} from '../../../src/domain/incomeCategories';

const cat = (name: string, sortOrder: number, categoryStatus = true) => ({name, sortOrder, categoryStatus});

it('is the active one first in order, wherever it sits in the list', () => {
  expect(primaryIncomeCategory([cat('B', 20), cat('A', 10), cat('C', 30)])?.name).toBe('A');
});

it('skips archived ones, even first in order', () => {
  expect(primaryIncomeCategory([cat('Old', 5, false), cat('Salary', 10)])?.name).toBe('Salary');
});

it('the first listed wins a tie, so the same list always gives the same answer', () => {
  expect(primaryIncomeCategory([cat('X', 10), cat('Y', 10)])?.name).toBe('X');
});

it('is nothing when none is active, or there are none', () => {
  expect(primaryIncomeCategory([cat('Old', 5, false)])).toBeNull();
  expect(primaryIncomeCategory([])).toBeNull();
});
