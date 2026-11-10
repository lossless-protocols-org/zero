import NativeWidgetBridge from '../../native/specs/NativeWidgetBridge';
import NativeQuickAddWindow from '../../native/specs/NativeQuickAddWindow';
import NativePendingEntries from '../../native/specs/NativePendingEntries';

/**
 * The only module that talks to the native modules (the layer rules in
 * .dependency-cruiser.cjs). Each spec covers what its platforms really have
 * (audit 2026-11-08 §6.2); where a module does not exist (the other
 * platform, jest) every call here is a no-op, so callers never branch on the
 * platform.
 */

/** True where a home-screen widget can be drawn (both platforms; not under jest). */
export const hasWidgetBridge = (): boolean => NativeWidgetBridge !== null;

export const writeWidgetSnapshot = (json: string): void => NativeWidgetBridge?.writeSnapshot(json);

/** Closes the quick-add sheet; the user is back where they were (Android: usually the home screen). */
export const closeQuickAdd = (): void => NativeQuickAddWindow?.closeQuickAdd();

/** Fades the dim behind the sheet out, in step with the card leaving (Android). */
export const fadeQuickAddScrim = (durationMs: number): void => NativeQuickAddWindow?.fadeQuickAddScrim(durationMs);

/** Hands over to the full app at a zero:// screen, closing the sheet (Android). */
export const openInApp = (url: string): void => NativeQuickAddWindow?.openInApp(url);

/** Entries made outside the app and not yet saved (JSON array); "[]" where there is no queue (Android). */
export const readPendingEntries = async (): Promise<string> =>
  (await NativePendingEntries?.readPendingEntries()) ?? '[]';

export const removePendingEntries = (ids: string[]): void => NativePendingEntries?.removePendingEntries(ids);
