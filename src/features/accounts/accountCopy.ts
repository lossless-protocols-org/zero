import type {ParseKeys} from 'i18next';
import type {AccountClass, AccountType} from '../../domain/accounts';

/** The icon a new account of each stored type starts with (all in the icon registry). */
export const ACCOUNT_TYPE_ICON: Record<AccountType, string> = {
  cash: 'wallet',
  bank: 'landmark',
  card: 'credit-card',
  wallet: 'wallet',
  investment: 'trending-up',
  other: 'piggy-bank',
  loan: 'hand-coins',
};

/** What setting an account's balance by hand is called, by its class: three acts on one engine. */
export const CHECK_LABEL: Record<AccountClass, ParseKeys> = {
  spend: 'accounts.reconcile',
  card: 'accounts.checkOwed',
  loan: 'accounts.checkOwed',
  save: 'accounts.updateValue',
};

/**
 * A signed amount as typed: '-1200.50', '1200,5', '−300'. A comma is the
 * decimal mark, as it is on the keyboards of most of Europe and Latin
 * America; grouping marks are not read, by the rule every amount field in
 * the app follows (domain/amountInput.ts). Before the world review (W5) a
 * comma was dropped as grouping, so '1200,50' became 120,050 without a word.
 * NaN for anything else.
 */
export const parseSignedAmount = (text: string): number => {
  const clean = text.replace(/\s/g, '').replace('−', '-').replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(clean) ? Number(clean) : Number.NaN;
};

/** An amount with its direction shown: "+₹2,400", "−₹300", "₹0". `format` formats a non-negative amount. */
export const signedAmount = (format: (amount: number) => string, amount: number): string => {
  if (amount > 0) {
    return `+${format(amount)}`;
  }
  return amount < 0 ? `−${format(-amount)}` : format(0);
};
