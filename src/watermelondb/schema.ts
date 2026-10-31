import {appSchema, tableSchema} from '@nozbe/watermelondb';
import {EXPENSES_USER_DATE_INDEX_SQL} from './indexes';

export const schema = appSchema({
  version: 4,
  tables: [
    tableSchema({
      name: 'users',
      columns: [
        {name: 'username', type: 'string'},
        {name: 'email', type: 'string'},
      ],
    }),
    tableSchema({
      name: 'categories',
      columns: [
        {name: 'name', type: 'string'},
        {name: 'category_status', type: 'boolean', isIndexed: true},
        {name: 'user_id', type: 'string', isIndexed: true},
        {name: 'icon', type: 'string', isOptional: true},
        {name: 'color', type: 'string'},
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
      ],
      // v4: the composite index the month/day range queries need (see indexes.ts).
      unsafeSql: sql => sql + EXPENSES_USER_DATE_INDEX_SQL,
    }),
    tableSchema({
      name: 'currencies',
      columns: [
        {name: 'code', type: 'string'},
        {name: 'symbol', type: 'string'},
        {name: 'name', type: 'string'},
        {name: 'user_id', type: 'string', isIndexed: true},
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
      ],
    }),
  ],
});

export default schema;
