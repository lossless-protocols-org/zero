import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

/**
 * Android only (2.8): the quick-add sheet's own see-through window over the
 * home screen (QuickAddActivity), and handing over from it to the app. Kotlin
 * `bridge/QuickAddWindowModule`. Null on iOS, where the sheet is a screen
 * inside the app and leaves by going back.
 */
/** @internal codegen — RN codegen reads this to generate NativeQuickAddWindowSpec. */
export interface Spec extends TurboModule {
  /** Closes the quick-add sheet, back to whatever was under it. */
  closeQuickAdd(): void;
  /** Fades the sheet window's dim to nothing over `durationMs`, as the card leaves. */
  fadeQuickAddScrim(durationMs: number): void;
  /** Opens a zero:// screen in the full app and closes the quick-add sheet. */
  openInApp(url: string): void;
}

export default TurboModuleRegistry.get<Spec>('NativeQuickAddWindow');
