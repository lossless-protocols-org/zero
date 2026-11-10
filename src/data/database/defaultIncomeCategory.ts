/**
 * The income category every user has (2.8; Free has exactly one,
 * domain/freeTier). Seeded where users come from, so money in always has
 * somewhere to land without any screen having to create it (audit 2026-11-08
 * §4.1): createUser, the v5 upgrade (v5Backfill.ts) and a restore (the import
 * planner). Its id derives from the user id, like the default account's, so a
 * seed that runs twice inserts once. The name is stored in English and
 * translated on display (i18n/displayNames.ts).
 */
export const DEFAULT_INCOME_CATEGORY_PREFIX = 'inc_';
export const DEFAULT_INCOME_CATEGORY_NAME = 'Income';
export const DEFAULT_INCOME_CATEGORY_ICON = 'coins';
export const DEFAULT_INCOME_CATEGORY_COLOR = '#3D9960';

export const defaultIncomeCategoryId = (userId: string): string => `${DEFAULT_INCOME_CATEGORY_PREFIX}${userId}`;
