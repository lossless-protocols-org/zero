import {
  DEFAULT_ACCOUNT_COLOR,
  DEFAULT_ACCOUNT_ICON,
  DEFAULT_ACCOUNT_NAME,
  DEFAULT_ACCOUNT_PREFIX,
} from './defaultAccount';
import {
  DEFAULT_INCOME_CATEGORY_COLOR,
  DEFAULT_INCOME_CATEGORY_ICON,
  DEFAULT_INCOME_CATEGORY_NAME,
  DEFAULT_INCOME_CATEGORY_PREFIX,
} from './defaultIncomeCategory';

/**
 * The data half of the v4 → v5 migration, one SQL string run after the new
 * tables and columns exist. Every statement is idempotent: inserts are
 * `or ignore` on a deterministic id, updates only touch rows still holding
 * the value addColumns wrote ('' / 0), indexes are `if not exists`.
 *
 * Timestamps of entries come from their own date: `strftime('%s', date)`
 * reads both 'YYYY-MM-DD' and the local 'YYYY-MM-DDTHH:mm:ss' the app writes
 * (as UTC, so they carry the device's zone offset: fine for ordering and
 * stated so nobody treats them as exact), and null for anything else, where
 * the upgrade time is used. `epochFromIsoDate` (domain/isoEpoch.ts) computes
 * the same value in JS for imports, so an upgrade and a restore of the same
 * data end with the same timestamps.
 *
 * Kept in its own module (no WatermelonDB import) so the bun upgrade test runs
 * exactly this text.
 */
const NOW = "cast(strftime('%s','now') as integer) * 1000";
const FROM_DATE = `coalesce(cast(strftime('%s', substr(date, 1, 19)) as integer) * 1000, ${NOW})`;
const UNSET = 'created_at = 0 or created_at is null';

const stampFromNow = (table: string): string =>
  `update "${table}" set created_at = ${NOW}, updated_at = ${NOW} where ${UNSET};`;
const stampFromDate = (table: string): string =>
  `update "${table}" set created_at = ${FROM_DATE}, updated_at = ${FROM_DATE} where ${UNSET};`;

export const V5_BACKFILL_SQL = [
  // One default account per user. The currency is the user's (2.8 is single-currency).
  `insert or ignore into "accounts" (id, _changed, _status, user_id, name, type, currency, opening_balance,` +
    ` opening_date, is_default, account_status, sort_order, icon, color, created_at, updated_at)` +
    ` select '${DEFAULT_ACCOUNT_PREFIX}' || u.id, '', 'created', u.id, '${DEFAULT_ACCOUNT_NAME}', 'cash',` +
    ` coalesce((select c.code from currencies c where c.user_id = u.id and c._status is not 'deleted' limit 1), ''),` +
    ` 0, null, 1, 1, 0, '${DEFAULT_ACCOUNT_ICON}', '${DEFAULT_ACCOUNT_COLOR}', ${NOW}, ${NOW} from users u;`,
  `update "expenses" set account_id = '${DEFAULT_ACCOUNT_PREFIX}' || user_id where account_id = '' or account_id is null;`,
  stampFromDate('expenses'),
  `update "categories" set kind = 'expense' where kind = '' or kind is null;`,
  // rowid is the order users see today (insertion); ×10 leaves room for inserts.
  `update "categories" set sort_order = rowid * 10 where sort_order = 0 or sort_order is null;`,
  // Every user gets the income category money in lands in (defaultIncomeCategory.ts), unless one
  // exists already. After the two statements above, so every older category is already 'expense'.
  `insert or ignore into "categories" (id, _changed, _status, user_id, name, kind, sort_order, category_status,` +
    ` icon, color, created_at, updated_at)` +
    ` select '${DEFAULT_INCOME_CATEGORY_PREFIX}' || u.id, '', 'created', u.id, '${DEFAULT_INCOME_CATEGORY_NAME}',` +
    ` 'income', 10, 1, '${DEFAULT_INCOME_CATEGORY_ICON}', '${DEFAULT_INCOME_CATEGORY_COLOR}', ${NOW}, ${NOW}` +
    ` from users u where not exists (select 1 from categories c where c.user_id = u.id and c.kind = 'income'` +
    ` and c._status is not 'deleted');`,
  stampFromNow('categories'),
  stampFromDate('debts'),
  stampFromNow('debtors'),
  stampFromNow('budgets'),
  stampFromNow('currencies'),
  stampFromNow('users'),
].join('');
