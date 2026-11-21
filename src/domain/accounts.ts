import {MAX_TEXT} from './limits';
import type {CheckpointKind} from './types';

/**
 * The stored account types (3.0, ZERO_3.0_PRO.md §5). They are the behaviour
 * key: what the user sees is the class below. A card and a loan are
 * liabilities: their balance is normally below zero and reads as "you owe".
 * An investment holds the value the user types; zero never asks for a fund,
 * a quantity or a price. `loan` joined in the held-and-owed model
 * (ZERO_3.0_TO_FIX_APPROVED.md A2); the list only ever grows.
 */
export const ACCOUNT_TYPES = ['cash', 'bank', 'card', 'wallet', 'investment', 'other', 'loan'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/**
 * The four things an account can be to its owner (approved model A2/A3),
 * one word each. Every sum in the app reads the class, never the kind:
 * - spend: money to use today (cash, bank, wallet, and the old "other");
 * - save: money put away (investments, deposits);
 * - card: borrowed each time it pays, and can pay;
 * - loan: borrowed once and paid off, and cannot pay.
 */
export const ACCOUNT_CLASSES = ['spend', 'save', 'card', 'loan'] as const;
export type AccountClass = (typeof ACCOUNT_CLASSES)[number];

/** The one place a stored type becomes a class. */
export const classOf = (type: AccountType): AccountClass => {
  if (type === 'card' || type === 'loan') {
    return type;
  }
  return type === 'investment' ? 'save' : 'spend';
};

/** Money is held or owed, nothing else: net worth is the first less the second. */
export type AccountSide = 'held' | 'owed';
export const sideOf = (accountClass: AccountClass): AccountSide =>
  accountClass === 'card' || accountClass === 'loan' ? 'owed' : 'held';

/** True for a card or a loan: its balance is what is owed, stored below zero. */
export const isOwedType = (type: AccountType): boolean => sideOf(classOf(type)) === 'owed';

/** An expense can be paid from money to spend or from a card; never from a loan or from savings. */
export const canPayFrom = (type: AccountType): boolean => {
  const accountClass = classOf(type);
  return accountClass === 'spend' || accountClass === 'card';
};

/** The stored type a new account of a class takes. A spend account's follows its kind (below). */
const TYPE_OF_CLASS: Record<Exclude<AccountClass, 'spend'>, AccountType> = {
  save: 'investment',
  card: 'card',
  loan: 'loan',
};

/**
 * The user's own one-word label for an account ("Bank", "Gold", "Later").
 * It decides the icon, the sub-heading and a subtotal. No sum reads it.
 */
export const ACCOUNT_KIND_MAX = 20;

/** The kind as stored: trimmed, inner runs of space made one. */
export const cleanAccountKind = (kind: string): string => kind.trim().replace(/\s+/g, ' ');

/** Two kinds that read the same are one kind. */
export const accountKindKey = (kind: string): string => cleanAccountKind(kind).toLocaleLowerCase('en');

/** Empty, or one short label. */
export const isValidAccountKind = (kind: string): boolean => cleanAccountKind(kind).length <= ACCOUNT_KIND_MAX;

/** The built-in kind a stored type stands for when the user gave none, or null when it has none. */
export type BuiltInKind = 'cash' | 'bank' | 'wallet' | 'credit';
export const builtInKindOf = (type: AccountType): BuiltInKind | null => {
  if (type === 'cash' || type === 'bank' || type === 'wallet') {
    return type;
  }
  return type === 'card' ? 'credit' : null;
};

/**
 * The stored type for a new or edited account of `accountClass` whose kind
 * reads `kind`: a spend account called Cash or Wallet keeps the type old
 * backups and older apps know; any other word is a bank-like place.
 */
export const storedTypeFor = (accountClass: AccountClass, kind: string): AccountType => {
  if (accountClass !== 'spend') {
    return TYPE_OF_CLASS[accountClass];
  }
  const key = accountKindKey(kind);
  return key === 'cash' || key === 'wallet' ? key : 'bank';
};

/** A stored type as the app reads it: anything unknown (a hand-edited backup) is 'other'. */
export const toAccountType = (value: string): AccountType =>
  (ACCOUNT_TYPES as readonly string[]).includes(value) ? (value as AccountType) : 'other';

/**
 * The longest account name the form accepts. Far under the backup's own
 * bound (MAX_TEXT), which a restored name may use; the service refuses past that.
 */
export const ACCOUNT_NAME_MAX = 25;

/** The name as stored: surrounding space removed. */
export const cleanAccountName = (name: string): string => name.trim();

/**
 * Two names that read the same are one name: backups refer to accounts by
 * name, so two accounts called "Savings" and "savings " would be one on
 * restore, and every transfer between them would be refused as a transfer
 * to itself (P7 review).
 */
export const accountNameKey = (name: string): string => cleanAccountName(name).toLocaleLowerCase('en');

/** Non-empty after trimming, and within the bound a backup row may carry. */
export const isValidAccountName = (name: string): boolean => {
  const clean = cleanAccountName(name);
  return clean.length > 0 && clean.length <= MAX_TEXT;
};

/** Which of the four net-worth lines an account's balance lands on (design §2.1). */
export type PositionLine = 'cashAndBank' | 'investments' | 'youOwe' | 'owedToYou';

/**
 * Money to spend is its own line, below zero included (an overdraft is
 * still the account's own balance). Money put away is its own line. A card
 * or a loan is what you owe while its balance is below zero; paid beyond
 * nothing, the lender owes you, exactly as a person whose tally flips, and
 * it is never counted as money in hand (approved model A2).
 */
export const positionLineOf = (type: AccountType, balanceUnits: number): PositionLine => {
  const accountClass = classOf(type);
  if (accountClass === 'save') {
    return 'investments';
  }
  if (accountClass === 'spend') {
    return 'cashAndBank';
  }
  return balanceUnits < 0 ? 'youOwe' : 'owedToYou';
};

/** A stored checkpoint kind as the app reads it: anything unknown is an adjustment, the neutral reading. */
export const toCheckpointKind = (value: string): CheckpointKind =>
  value === 'revaluation' ? 'revaluation' : 'adjustment';

/** A checkpoint's kind follows its account: an investment's gap is a value change (R15), any other an adjustment. */
export const checkpointKindFor = (type: AccountType): CheckpointKind =>
  type === 'investment' ? 'revaluation' : 'adjustment';
