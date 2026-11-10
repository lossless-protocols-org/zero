import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

/**
 * The home-screen widget (2.8), on both platforms: the app pushes one small
 * JSON snapshot; the widget never opens the database. Android: Kotlin
 * `bridge/WidgetBridgeModule` (SharedPreferences, an AppWidgetManager update,
 * the picker preview and launcher shortcuts). iOS: `ios/zero/Widget/
 * ZeroWidgetBridge.mm` over `ZeroWidgetStore` (the App Group store WidgetKit
 * and Siri read).
 *
 * One spec per platform reach (audit 2026-11-08 §6.2): what only one
 * platform has lives in NativeQuickAddWindow (Android) and
 * NativePendingEntries (iOS), which resolve to null elsewhere, so TypeScript
 * sees the gap instead of a method that silently does nothing.
 */
/** @internal codegen — RN codegen reads this to generate NativeWidgetBridgeSpec. */
export interface Spec extends TurboModule {
  /** Stores the snapshot and redraws every placed widget. */
  writeSnapshot(json: string): void;
}

export default TurboModuleRegistry.get<Spec>('NativeWidgetBridge');
