/**
 * Run work once the UI has had a chance to settle.
 *
 * React Native 0.88 removed `InteractionManager` from core ("refactor long
 * tasks into smaller ones, and use requestIdleCallback instead"). The two
 * callers here never needed interaction tracking — they only wanted "not
 * during the first frame of a screen": the swipe tutorial waits for the list to
 * be on screen before animating a row, and the crash prompt waits so its dialog
 * does not fight the navigation transition. `requestIdleCallback` gives exactly
 * that, with a timeout so the work is never starved on a busy device.
 */
interface Cancellable {
  cancel: () => void;
}

const IDLE_TIMEOUT_MS = 1000;

export const afterInteractions = (work: () => void): Cancellable => {
  // React Native declares both globals; `typeof` keeps a runtime without them (tests) safe.
  if (typeof requestIdleCallback === 'function' && typeof cancelIdleCallback === 'function') {
    const handle = requestIdleCallback(work, {timeout: IDLE_TIMEOUT_MS});
    return {cancel: () => cancelIdleCallback(handle)};
  }
  // Test runners and older runtimes: next macrotask is the closest equivalent.
  const timer = setTimeout(work, 0);
  return {cancel: () => clearTimeout(timer)};
};
