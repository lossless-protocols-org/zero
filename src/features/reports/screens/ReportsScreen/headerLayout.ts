/**
 * Below this width (dp) the Total and Avg/day tiles beside the month pill get
 * under ~90 dp each and their amounts shrink past comfortable reading.
 */
const NARROW_WIDTH_DP = 360;

/**
 * 'row': pill + two tiles on one line; 'stacked': pill on its own line above
 * them. Measured in text-scaled width: large system text on a wide phone needs
 * the room as much as a narrow phone does (iPhone 16 at Accessibility L).
 */
export const reportsHeaderLayout = (windowWidthDp: number, fontScale: number): 'row' | 'stacked' =>
  windowWidthDp / Math.max(fontScale, 1) < NARROW_WIDTH_DP ? 'stacked' : 'row';
