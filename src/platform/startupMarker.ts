// RN's LOG_LEVELS.info; the Android hook writes it to logcat as INFO.
const INFO = 1;

const written = new Set<string>();

const markOnce = (name: string, now: number): void => {
  if (written.has(name)) {
    return;
  }
  written.add(name);
  globalThis.nativeLoggingHook?.(`${name} ${Math.round(now)}`, INFO);
};

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
  markOnce('zero:tti', now);
  const waiting = [...interactiveListeners];
  interactiveListeners.clear();
  waiting.forEach(listener => listener());
};

const interactiveListeners = new Set<() => void>();

/**
 * Runs `listener` once Home's first rows are on screen (at once if they
 * already are); returns a function that stops waiting. Work that would compete
 * with the first frames (the widget's first publish) starts from here.
 */
export const onTimeToInteractive = (listener: () => void): (() => void) => {
  if (written.has('zero:tti')) {
    listener();
    return () => undefined;
  }
  interactiveListeners.add(listener);
  return () => {
    interactiveListeners.delete(listener);
  };
};

/**
 * Writes `zero:add <ms>` once per process when Add expense first lays out:
 * where the widget's "+" lands, read the same way as `zero:tti` (2.8 gate:
 * widget tap to a usable Add screen within Home's cold start + 150 ms).
 */
export const markAddScreenReady = (now: number = performance.now()): void => markOnce('zero:add', now);
