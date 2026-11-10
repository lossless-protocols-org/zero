/** Gap between neighbours in sort_order, so an insert between two never renumbers the list. */
export const CATEGORY_SORT_STEP = 10;

/**
 * The sort_order of the category at `index` in a list: a reorder, a backup's
 * categories in file order (a v4 file has none stored, a v5 file may omit
 * them). One rule for the app, the upgrader and the import planner (audit
 * 2026-11-08 §3.13). The v5 database migration wrote `rowid * 10` and stays
 * frozen as written.
 */
export const sortOrderAt = (index: number): number => (index + 1) * CATEGORY_SORT_STEP;

/**
 * Category reorder (bug sheet #15, 2.8). A kind's stored order covers its
 * archived categories too, but the user only sees and moves the active ones:
 * "up" swaps with the nearest active category above, "down" with the nearest
 * below, "top" puts it before every other. Archived ones keep their places
 * relative to each other. Returns the new id order, or null for no change.
 */
export type OrderMove = 'up' | 'down' | 'top';

export const moveInOrder = (
  rows: ReadonlyArray<{id: string; active: boolean}>,
  id: string,
  move: OrderMove,
): string[] | null => {
  const ids = rows.map(r => r.id);
  const from = ids.indexOf(id);
  if (from < 0) {
    return null;
  }
  const activeIndexes = rows.flatMap((r, i) => (r.active ? [i] : []));
  const position = activeIndexes.indexOf(from);
  if (position < 0) {
    return null;
  }
  if (move === 'top') {
    const first = activeIndexes[0];
    if (first === undefined || first === from) {
      return null;
    }
    const next = ids.filter(x => x !== id);
    next.splice(first, 0, id);
    return next;
  }
  const neighbour = activeIndexes[move === 'up' ? position - 1 : position + 1];
  if (neighbour === undefined) {
    return null;
  }
  const next = [...ids];
  // both indexes come from `ids`, so both entries exist
  next[from] = ids[neighbour] as string;
  next[neighbour] = id;
  return next;
};

/**
 * A drag's result (2.8): `activeOrder` is the active categories in their new
 * order; archived ones keep their slots, the active ones fill the rest in
 * that order. Returns the full new id order, or null when nothing moved or
 * `activeOrder` does not list exactly the active categories.
 */
export const placeActiveOrder = (
  rows: ReadonlyArray<{id: string; active: boolean}>,
  activeOrder: readonly string[],
): string[] | null => {
  const active = rows.filter(r => r.active).map(r => r.id);
  if (active.length !== activeOrder.length || active.some(id => !activeOrder.includes(id))) {
    return null;
  }
  if (active.every((id, i) => activeOrder[i] === id)) {
    return null;
  }
  let next = 0;
  return rows.map(r => (r.active ? (activeOrder[next++] ?? r.id) : r.id));
};
