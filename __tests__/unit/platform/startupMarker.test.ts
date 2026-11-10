/**
 * 2.7.1 gate, TTI: a one-line `zero:tti <ms>` logcat marker when Home first
 * commits a list with rows, once per process. Release-safe: App.tsx turns
 * every console method into a no-op outside __DEV__, so the marker writes
 * through RN's native logging hook (what console.log itself calls).
 */
import {markAddScreenReady, markTimeToInteractive} from '../../../src/platform/startupMarker';

it('writes one zero:tti line at info level through the native hook, not console', () => {
  const hook = jest.fn();
  globalThis.nativeLoggingHook = hook;
  const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  markTimeToInteractive(812.6);
  markTimeToInteractive(1500);
  expect(hook.mock.calls).toEqual([['zero:tti 813', 1]]);
  expect(log).not.toHaveBeenCalled();
  log.mockRestore();
  globalThis.nativeLoggingHook = undefined;
});

it('writes zero:add once, independently of zero:tti', () => {
  const hook = jest.fn();
  globalThis.nativeLoggingHook = hook;
  markAddScreenReady(400.2);
  markAddScreenReady(900);
  expect(hook.mock.calls).toEqual([['zero:add 400', 1]]);
  globalThis.nativeLoggingHook = undefined;
});
