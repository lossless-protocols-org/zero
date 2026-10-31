import {booleanValue, createMmkvPreference} from './mmkvPreference';

/**
 * Whether rows reveal Edit/Delete on swipe. Issue #40 and a Play review asked
 * to turn the swipe off because a stray drag deleted a loan record. When it is
 * off, the same actions live behind a long-press menu (and, as always, behind
 * the screen-reader actions).
 *
 * Every mounted SwipeableRow reads it, so the value is cached (S5) and the
 * Settings toggle re-renders the rows through `use()`.
 */
export const swipeActionsPreference = createMmkvPreference('swipeActionsEnabled', booleanValue, true);
