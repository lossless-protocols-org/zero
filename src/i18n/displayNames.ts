import type {ParseKeys, TFunction} from 'i18next';

/**
 * Names the app seeds are stored in English: backups match categories and
 * debtors by name, so a stored name must not change with the language. They
 * are translated where they are shown instead, keyed by the stored English
 * text (M32, v2.7.1). Anything the user typed is shown as typed.
 */

/** Stored on a settle-up debt; shown as `debts.settlementDescription`. */
export const SETTLEMENT_DESCRIPTION = 'Settled up';

/** The name a user who skipped Personalize (or an imported nameless one) gets. */
export const DEFAULT_USER_NAME = 'User';

/** What an export writes for a transaction or debt whose category/debtor is gone. */
export const UNKNOWN_NAME = 'Unknown';

// Keys of en.json's defaultCategories / defaultDebtAccounts by the English
// name in assets/jsons/default*.json, plus the export's UNKNOWN_NAME.
const CATEGORY_KEYS: ReadonlyMap<string, ParseKeys> = new Map<string, ParseKeys>([
  ['Food', 'defaultCategories.food'],
  ['Transportation', 'defaultCategories.transportation'],
  ['Entertainment', 'defaultCategories.entertainment'],
  ['Healthcare', 'defaultCategories.healthcare'],
  ['Shopping', 'defaultCategories.shopping'],
  ['Travel', 'defaultCategories.travel'],
  ['Utilities', 'defaultCategories.utilities'],
  ['Education', 'defaultCategories.education'],
  ['Gifts', 'defaultCategories.gifts'],
  ['Other', 'defaultCategories.other'],
  [UNKNOWN_NAME, 'common.unknown'],
]);

const DEBT_ACCOUNT_KEYS: ReadonlyMap<string, ParseKeys> = new Map<string, ParseKeys>([
  ['Credit Card', 'defaultDebtAccounts.creditCard'],
  ['Person', 'defaultDebtAccounts.person'],
  ['Emi', 'defaultDebtAccounts.emi'],
  ['Loan', 'defaultDebtAccounts.loan'],
  ['Other', 'defaultDebtAccounts.other'],
  [UNKNOWN_NAME, 'common.unknown'],
]);

export const displayCategoryName = (name: string, t: TFunction): string => {
  const key = CATEGORY_KEYS.get(name);
  return key ? t(key) : name;
};

export const displayDebtAccountName = (name: string, t: TFunction): string => {
  const key = DEBT_ACCOUNT_KEYS.get(name);
  return key ? t(key) : name;
};

export const displayUserName = (name: string | null | undefined, t: TFunction): string =>
  name === DEFAULT_USER_NAME ? t('common.defaultUserName') : (name ?? '');

export const displayDebtDescription = (description: string, t: TFunction): string =>
  description === SETTLEMENT_DESCRIPTION ? t('debts.settlementDescription') : description;
