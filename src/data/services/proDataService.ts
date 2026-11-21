import type {Model} from '@nozbe/watermelondb';
import {database} from '../database/database';
import {extraIncomeCategoriesPart} from './incomeCategoryFold';
import {accountsPart} from './accountsFold';
import {recurringRulesPart} from './recurringFold';
import {monthStartPart} from './monthStartFold';

/**
 * What one part wants done to rows, gathered before anything is written. Two
 * parts may change the same row (an income on another account, in an extra
 * category); the plan folds their changes into one update, because a row
 * can be prepared for update only once per batch.
 */
interface RemovalPlan {
  update: <T extends Model>(record: T, change: (record: T) => void) => void;
  /** Deleting wins over any update planned for the same row. */
  destroy: (record: Model) => void;
}

/**
 * One kind of row a free user cannot see (3.0 law L9: nothing hidden is
 * unowned). The feature that adds such a table adds its part here in the same
 * commit: how many rows there are, and how the user's own "Remove Pro data"
 * disposes of them (deleting, or folding into what Free shows).
 *
 * Tier-blind like every service: nothing here asks who is paying. It counts
 * and removes rows; whether to show the count is the screen's business.
 */
export interface ProDataPart {
  key: string;
  count: () => Promise<number>;
  /** Adds this part's changes to the plan. Reads only; nothing is written until every part has planned. */
  planRemoval: (plan: RemovalPlan) => Promise<void>;
}

/**
 * Every kind of row Free does not show. A phase that adds a Pro table or column adds its part here.
 * @internal Read through the two functions below, which take it as their default.
 */
export const PRO_DATA_PARTS: readonly ProDataPart[] = [
  extraIncomeCategoriesPart,
  accountsPart,
  recurringRulesPart,
  monthStartPart,
];

/** How many rows exist that only Pro shows. */
export const countKeptProData = async (parts: readonly ProDataPart[] = PRO_DATA_PARTS): Promise<number> => {
  const counts = await Promise.all(parts.map(part => part.count()));
  return counts.reduce((sum, count) => sum + count, 0);
};

interface Planned {
  record: Model;
  changes: Array<(record: Model) => void>;
  destroy: boolean;
}

/** The planned changes as one batch's worth of prepared records: one per row. */
const preparedFrom = (planned: Iterable<Planned>): Model[] =>
  [...planned].flatMap(({record, changes, destroy}) => {
    if (destroy) {
      return [record.prepareDestroyPermanently()];
    }
    return changes.length > 0 ? [record.prepareUpdate(r => changes.forEach(change => change(r)))] : [];
  });

/**
 * Removes every part in one write and one batch: all of it, or none of it.
 * Only ever on the user's own confirmed request; it cannot be undone.
 */
export const removeProData = async (parts: readonly ProDataPart[] = PRO_DATA_PARTS): Promise<void> => {
  await database.write(async () => {
    const byRow = new Map<string, Planned>();
    const entry = (record: Model): Planned => {
      const key = `${record.table}/${record.id}`;
      const found = byRow.get(key);
      if (found) {
        return found;
      }
      const created: Planned = {record, changes: [], destroy: false};
      byRow.set(key, created);
      return created;
    };
    const plan: RemovalPlan = {
      update: (record, change) => {
        // The change was written for this record's own class; the plan only stores it beside the record.
        entry(record).changes.push(change as (r: Model) => void);
      },
      destroy: record => {
        entry(record).destroy = true;
      },
    };
    // One after another: a part may read what an earlier part planned to keep.
    for (const part of parts) {
      await part.planRemoval(plan);
    }
    await database.batch(preparedFrom(byRow.values()));
  });
};
