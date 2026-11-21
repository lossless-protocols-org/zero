import type {ParseKeys, TFunction} from 'i18next';
import {
  builtInKindOf,
  cleanAccountKind,
  type AccountClass,
  type AccountType,
  type BuiltInKind,
} from '../domain/accounts';

/**
 * The words the held-and-owed model shows (approved A2/A3): one word per
 * class, used as the section headings on the Money and Debts tabs and as the
 * choice on the account form. Shared by every feature that lists accounts.
 */
export const CLASS_LABEL: Record<AccountClass, ParseKeys> = {
  spend: 'accounts.classSpend',
  save: 'accounts.classSave',
  card: 'accounts.classCard',
  loan: 'accounts.classLoan',
};

/** What each class means, in a line, under the choice on the form. */
export const CLASS_MEANING: Record<AccountClass, ParseKeys> = {
  spend: 'accounts.meansSpend',
  save: 'accounts.meansSave',
  card: 'accounts.meansCard',
  loan: 'accounts.meansLoan',
};

/** The icon a class is drawn with where no account's own icon applies. */
export const CLASS_ICON: Record<AccountClass, string> = {
  spend: 'wallet',
  save: 'trending-up',
  card: 'credit-card',
  loan: 'hand-coins',
};

const BUILT_IN_KIND_LABEL: Record<BuiltInKind, ParseKeys> = {
  cash: 'accounts.typeCash',
  bank: 'accounts.typeBank',
  wallet: 'accounts.typeWallet',
  credit: 'accounts.kindCredit',
};

/**
 * The label an account's kind is shown under: the user's own word, else the
 * one its stored type stands for, else none (''). Display only.
 */
export const kindLabelOf = (account: {type: AccountType; kind: string}, t: TFunction): string => {
  const own = cleanAccountKind(account.kind);
  if (own) {
    return own;
  }
  const builtIn = builtInKindOf(account.type);
  return builtIn ? t(BUILT_IN_KIND_LABEL[builtIn]) : '';
};

/** A balance as read: below zero with a minus sign, else as it is. `format` formats a non-negative amount. */
export const formatBalance = (format: (amount: number) => string, amount: number): string =>
  amount < 0 ? `−${format(-amount)}` : format(amount);
