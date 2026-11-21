/**
 * The Free view of income categories (3.0 law L5): the same rows, fewer
 * listed. Nothing is filtered out of the data; the screen lists one.
 */
import {capsOf} from '../../../src/pro/features';
import {projectIncomeCategories} from '../../../src/pro/projection';

const cat = (id: string, sortOrder: number, categoryStatus = true) => ({id, sortOrder, categoryStatus});
const restored = [cat('old', 5, false), cat('freelance', 20), cat('salary', 10)];

it('with Pro, lists every active one, in the order given, and draws each row under its own', () => {
  expect(projectIncomeCategories(restored, capsOf(true))).toEqual({
    listed: [cat('freelance', 20), cat('salary', 10)],
    oneCategory: null,
    complete: true,
  });
});

it('without Pro, lists the primary alone and draws every row under it', () => {
  expect(projectIncomeCategories(restored, capsOf(false))).toEqual({
    listed: [cat('salary', 10)],
    oneCategory: cat('salary', 10),
    complete: false,
  });
});

it('without Pro and with one category, it is simply that one', () => {
  expect(projectIncomeCategories([cat('income', 10)], capsOf(false)).listed).toEqual([cat('income', 10)]);
});

it('lists nothing rather than an archived one when none is active (the session repairs that)', () => {
  expect(projectIncomeCategories([cat('old', 5, false)], capsOf(false))).toEqual({
    listed: [],
    oneCategory: null,
    complete: false,
  });
});
