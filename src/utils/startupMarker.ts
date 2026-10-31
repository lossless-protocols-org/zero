let marked = false;

// RN's LOG_LEVELS.info; the Android hook writes it to logcat as INFO.
const INFO = 1;

/**
 * Writes `zero:tti <ms>` once per process; the 2.7.1 start-up gate reads it
 * with `adb logcat -s ReactNativeJS`. It goes through RN's native logging hook
 * because App.tsx turns every console method into a no-op in release builds.
 * `<ms>` is `performance.now()`, which on Android counts from device boot, so
 * it only orders events. The gate figure ("from process start") is the logcat
 * interval from ActivityManager's "Start proc" line to this one: bridgeless
 * Android logs no app-start marker JS could subtract (Moto g84, 10k rows:
 * 797–875 ms, 2026-10-31).
 */
export const markTimeToInteractive = (now: number = performance.now()): void => {
  if (marked) {
    return;
  }
  marked = true;
  globalThis.nativeLoggingHook?.(`zero:tti ${Math.round(now)}`, INFO);
};
