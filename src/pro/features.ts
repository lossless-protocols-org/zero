/**
 * What Pro unlocks (3.0, handbook/blueprint/ZERO_3.0_PLAN.md P8 to P14). A
 * screen asks for one of these by name (`useProFeature`, `<ProSlot>`), never
 * for the tier, so what a tier includes is decided here and nowhere else.
 * @internal Used by `capsOf`; tests list it.
 */
export const PRO_FEATURES = [
  'accounts',
  'netWorth',
  'incomeCategories',
  'recurring',
  'cloudBackup',
  'monthStart',
  'trends',
  'reports',
  'search',
  'smartEntry',
  'voice',
] as const;
export type ProFeature = (typeof PRO_FEATURES)[number];

/**
 * The features that are built and in this build. The upgrade sheet lists only
 * these, so it can never sell something that does not exist yet: a phase adds
 * its feature here in the commit that ships its screens, never before. The
 * release checklist refuses to ship 3.0 while it is empty.
 */
export const SHIPPED_PRO_FEATURES: readonly ProFeature[] = [
  'accounts',
  'netWorth',
  'incomeCategories',
  'recurring',
  'cloudBackup',
  'monthStart',
  'trends',
  'reports',
];

const EVERYTHING: ReadonlySet<ProFeature> = new Set(PRO_FEATURES);
const NOTHING: ReadonlySet<ProFeature> = new Set();

/** The capabilities of a tier: all of Pro, or none of it. One purchase covers every feature. */
export const capsOf = (pro: boolean): ReadonlySet<ProFeature> => (pro ? EVERYTHING : NOTHING);
