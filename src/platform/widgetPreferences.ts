import {booleanValue, createMmkvPreference, wholeNumber} from './mmkvPreference';

/**
 * Settings → "Show amounts on widgets" (2.8). Off: the snapshot the app
 * writes for the widget carries "••••" instead of every figure, so amounts
 * never reach the widget's storage at all, not merely hidden on screen.
 */
export const widgetAmountsPreference = createMmkvPreference('widgetShowAmounts', booleanValue, true);

/**
 * The keyboard's height the last time the quick-add sheet opened (2.8), in
 * dp. The sheet lays itself out at this height before the keyboard has
 * finished opening, so it rises once with the keyboard instead of jumping
 * after it. 0 until first measured.
 */
export const quickAddKeyboardHeight = createMmkvPreference('quickAddKeyboardHeight', wholeNumber, 0);
