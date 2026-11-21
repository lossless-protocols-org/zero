import {primaryIncomeCategory} from '../domain/incomeCategories';
import type {ProFeature} from './features';

/**
 * The Free view of the same rows a Pro user has (3.0 law L5, entitlement
 * design §4). Nothing here writes: it decides what a screen lists, and the
 * rows behind it stay as they are, so Pro coming back shows them all again.
 */

/** Income categories as a screen shows them. */
export interface IncomeCategoryView<T> {
  /** The active income categories the screen lists and offers. */
  listed: T[];
  /**
   * Free only: the one category every money-in row is drawn under, whatever
   * category the row really has (its own stays stored, untouched). Null with Pro.
   */
  oneCategory: T | null;
  /** Whether every income category is shown (Pro), so more than one may be listed. */
  complete: boolean;
}

/**
 * Pro lists every active income category. Free lists one, the primary: a
 * restored Pro backup brings its other income categories along, and they
 * wait, unlisted and counted in Settings → Pro data kept, until Pro returns
 * or the user folds them in.
 */
export const projectIncomeCategories = <T extends {categoryStatus: boolean; sortOrder: number}>(
  categories: readonly T[],
  caps: ReadonlySet<ProFeature>,
): IncomeCategoryView<T> => {
  if (caps.has('incomeCategories')) {
    return {listed: categories.filter(category => category.categoryStatus), oneCategory: null, complete: true};
  }
  const primary = primaryIncomeCategory(categories);
  return {listed: primary ? [primary] : [], oneCategory: primary, complete: false};
};
