import type {QuickAddKind} from './useQuickAdd';

/**
 * Where the quick-add sheet is shown, and so how it leaves (2.8):
 * - Android: its own see-through window over the home screen (QuickAddActivity).
 *   The window dims itself; leaving fades that dim and finishes the activity.
 * - In the app (iOS, where a widget can only open the app; any zero:// quick
 *   link): a transparent screen over the app. The sheet draws its own scrim;
 *   leaving goes back.
 */
export interface QuickAddHost {
  /** The sheet is gone: close the window, or go back. */
  close: () => void;
  /** Hand over to the full form for this kind (a draft may be waiting). */
  openFull: (kind: QuickAddKind) => void;
  /** Leaving has begun and lasts `durationMs`: fade whatever dims the background. */
  dimLeaving: (durationMs: number) => void;
  /** True when the sheet draws its own scrim (no window dim behind it). */
  drawsScrim: boolean;
}
