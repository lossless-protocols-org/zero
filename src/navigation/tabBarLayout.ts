// Room for the icon and its one-line label, never under the 44 pt target. iOS
// stays close to the system's 49 pt bar; Android keeps its original 57.
const TAB_CONTENT_HEIGHT = {ios: 48, android: 57} as const;
const PADDING_TOP = 8;

/**
 * The bottom tab bar's height and padding for a given bottom inset. iOS used
 * to subtract 20 pt, which left 37 pt tab buttons on an iPhone 16 (2.7.1 iOS
 * pass).
 */
export const tabBarLayout = (
  bottomInset: number,
  os: 'ios' | 'android',
): {height: number; paddingTop: number; paddingBottom: number} => {
  // Android keeps 8 pt under the icons even with no inset (3-button nav).
  const paddingBottom = os === 'ios' ? bottomInset : Math.max(bottomInset, 8);
  return {height: TAB_CONTENT_HEIGHT[os] + PADDING_TOP + paddingBottom, paddingTop: PADDING_TOP, paddingBottom};
};
