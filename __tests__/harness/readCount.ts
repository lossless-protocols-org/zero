import {database} from '../../src/data/database/database';

/**
 * The adapter calls that read: each is one SQLite statement on the device
 * (JSI, synchronous on the JS thread). Collections call the underlying
 * adapter directly, not the compat wrapper, so that is where they are counted.
 */
const READS = ['find', 'query', 'queryIds', 'unsafeQueryRaw', 'count'] as const;

export interface ReadLog {
  /** How many reads ran. */
  count: number;
  /** One entry per read, in order: the method, its table and the columns it filters on. */
  reads: string[];
}

/** The columns a query's where clauses name, `on(table)` for a join, or `sql` for raw SQL. */
const describeWhere = (clauses: unknown): string[] =>
  Array.isArray(clauses)
    ? clauses.flatMap((clause: unknown): string[] => {
        if (typeof clause !== 'object' || clause === null || !('type' in clause)) {
          return [];
        }
        // `_status` is WatermelonDB's own "not deleted" filter, on every query.
        if (clause.type === 'where' && 'left' in clause && clause.left !== '_status') {
          return [String(clause.left)];
        }
        if (clause.type === 'on' && 'table' in clause) {
          return [`on(${String(clause.table)})`];
        }
        if ((clause.type === 'and' || clause.type === 'or') && 'conditions' in clause) {
          return describeWhere(clause.conditions);
        }
        return [];
      })
    : [];

/**
 * `find` takes the table name first; the others a serialized query:
 * "expenses(user_id,date)", "refunds(user_id,on(expenses))", "expenses(sql)".
 */
const describe = (first: unknown): string => {
  if (typeof first === 'string') {
    return first;
  }
  if (typeof first !== 'object' || first === null || !('table' in first)) {
    return '?';
  }
  const description = 'description' in first ? first.description : undefined;
  const isSql = typeof description === 'object' && description !== null && 'sql' in description && description.sql;
  const where =
    typeof description === 'object' && description !== null && 'where' in description ? description.where : [];
  const columns = isSql ? ['sql'] : [...new Set(describeWhere(where))];
  return `${String(first.table)}(${columns.join(',')})`;
};

/**
 * Runs `work` and records every read it sends to the database. A read budget
 * (`expect(log.count).toBe(3)`) pins how many synchronous SQLite calls a
 * screen action costs, which a timing on a CI machine cannot (audit
 * 2026-11-08 §8: with JSI every call blocks the JS thread).
 */
export const countReads = async (work: () => Promise<unknown>): Promise<ReadLog> => {
  const log: ReadLog = {count: 0, reads: []};
  const adapter = database.adapter.underlyingAdapter;
  const spies = READS.map(method => {
    const original = adapter[method].bind(adapter) as (...args: unknown[]) => unknown;
    return jest.spyOn(adapter, method).mockImplementation(((...args: unknown[]) => {
      log.count += 1;
      log.reads.push(`${method} ${describe(args[0])}`);
      return original(...args);
    }) as never); // each method keeps its own signature; the wrapper forwards the arguments untouched
  });
  try {
    await work();
  } finally {
    spies.forEach(spy => spy.mockRestore());
  }
  return log;
};
