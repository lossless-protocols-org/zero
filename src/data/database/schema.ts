import {appSchema, tableSchema} from '@nozbe/watermelondb';
import {EXPENSES_TITLE_KEY_INDEX_SQL, EXPENSES_USER_DATE_INDEX_SQL} from './indexes';
import {TIMESTAMP_COLUMNS, V5_TABLES} from './v5Tables';

/**
 * Two books on one database (references/blueprint/ZERO_SYSTEM_DESIGN.md):
 * flows (expenses, refunds, incomes) feed spent / received / kept; positions
 * (accounts, debts) feed net worth from 3.0. One table per fact: a row's
 * table says what it is, so no query can count the wrong kind of money.
 */
export const schema = appSchema({
  version: 5,
  tables: [
    tableSchema({
      name: 'users',
      columns: [{name: 'username', type: 'string'}, {name: 'email', type: 'string'}, ...TIMESTAMP_COLUMNS],
    }),
    tableSchema({
      name: 'categories',
      columns: [
        {name: 'name', type: 'string'},
        {name: 'category_status', type: 'boolean', isIndexed: true},
        {name: 'user_id', type: 'string', isIndexed: true},
        {name: 'icon', type: 'string', isOptional: true},
        {name: 'color', type: 'string'},
        // v5: 'expense' | 'income'; lists order by sort_order.
        {name: 'kind', type: 'string', isIndexed: true},
        {name: 'sort_order', type: 'number'},
        ...TIMESTAMP_COLUMNS,
      ],
    }),
    tableSchema({
      name: 'expenses',
      columns: [
        {name: 'title', type: 'string'},
        {name: 'amount', type: 'number'},
        {name: 'description', type: 'string', isOptional: true},
        {name: 'category_id', type: 'string', isIndexed: true},
        {name: 'user_id', type: 'string', isIndexed: true},
        {name: 'date', type: 'string', isIndexed: true},
        // v5: every expense is paid from an account (the hidden default in 2.8).
        {name: 'account_id', type: 'string', isIndexed: true},
        ...TIMESTAMP_COLUMNS,
      ],
      // v4: the composite index the month/day range queries need (see indexes.ts).
      unsafeSql: sql => sql + EXPENSES_USER_DATE_INDEX_SQL + EXPENSES_TITLE_KEY_INDEX_SQL,
    }),
    tableSchema({
      name: 'currencies',
      columns: [
        {name: 'code', type: 'string'},
        {name: 'symbol', type: 'string'},
        {name: 'name', type: 'string'},
        {name: 'user_id', type: 'string', isIndexed: true},
        ...TIMESTAMP_COLUMNS,
      ],
    }),
    tableSchema({
      name: 'debtors',
      columns: [
        {name: 'title', type: 'string'},
        {name: 'type', type: 'string'},
        {name: 'debtor_status', type: 'boolean', isIndexed: true},
        {name: 'user_id', type: 'string', isIndexed: true},
        {name: 'icon', type: 'string', isOptional: true},
        {name: 'color', type: 'string'},
        ...TIMESTAMP_COLUMNS,
      ],
    }),
    tableSchema({
      name: 'debts',
      columns: [
        {name: 'description', type: 'string'},
        {name: 'amount', type: 'number'},
        {name: 'debtor_id', type: 'string', isIndexed: true},
        {name: 'user_id', type: 'string', isIndexed: true},
        {name: 'date', type: 'string', isIndexed: true},
        {name: 'type', type: 'string'},
        ...TIMESTAMP_COLUMNS,
      ],
    }),
    tableSchema({
      name: 'budgets',
      columns: [
        {name: 'user_id', type: 'string', isIndexed: true},
        {name: 'category_id', type: 'string', isOptional: true, isIndexed: true},
        {name: 'amount', type: 'number'},
        {name: 'month', type: 'string', isIndexed: true},
        {name: 'budget_type', type: 'string'},
        ...TIMESTAMP_COLUMNS,
      ],
    }),
    // v5 tables, defined once and shared with the migration (v5Tables.ts).
    ...V5_TABLES.map(table => tableSchema(table)),
  ],
});
