/**
 * The income category money in lands in when nothing else is chosen: the
 * first ACTIVE one in the user's order. Free shows only this one (3.0,
 * src/pro/projection.ts); Pro lists them all and preselects it. Archived
 * ones never qualify while an active one exists.
 *
 * Null when there is no active income category, a state the session
 * bootstrap repairs (ensureIncomeCategory) and nothing else may rely on.
 */
export const primaryIncomeCategory = <T extends {categoryStatus: boolean; sortOrder: number}>(
  categories: readonly T[],
): T | null =>
  categories.reduce<T | null>(
    (best, category) =>
      category.categoryStatus && (best === null || category.sortOrder < best.sortOrder) ? category : best,
    null,
  );
