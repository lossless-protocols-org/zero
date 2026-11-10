/**
 * The account every user has from schema v5 on: hidden in 2.8, the default
 * for new entries in 3.0. Its id is derived from the user id so the v5
 * backfill is a pure UPDATE and an import recreates it deterministically.
 * The name is stored in English and translated on display, like seeded
 * category names (i18n/displayNames.ts).
 */
export const DEFAULT_ACCOUNT_PREFIX = 'acct_';
export const DEFAULT_ACCOUNT_NAME = 'Cash';
export const DEFAULT_ACCOUNT_ICON = 'wallet';
/** The theme's accentGreen, which already passes the contrast check. */
export const DEFAULT_ACCOUNT_COLOR = '#6E8B3D';

export const defaultAccountId = (userId: string): string => `${DEFAULT_ACCOUNT_PREFIX}${userId}`;
