import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

/**
 * iOS only (2.8): entries made outside the app — Siri, Shortcuts, a Control
 * Center control, the keypad widget — wait in an App Group queue until the
 * app saves them through the normal services (features/widgets/
 * pendingEntries.ts). `ios/zero/Widget/ZeroPendingEntries.mm`. Null on
 * Android, where quick add runs inside the app and nothing is ever pending.
 */
/** @internal codegen — RN codegen reads this to generate NativePendingEntriesSpec. */
export interface Spec extends TurboModule {
  /** The queue as a JSON array, oldest first. */
  readPendingEntries(): Promise<string>;
  /** Drops entries the app has saved (by id). */
  removePendingEntries(ids: Array<string>): void;
}

export default TurboModuleRegistry.get<Spec>('NativePendingEntries');
