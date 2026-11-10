/**
 * M22 (v2.7.1): what the release build does with errors nobody caught. The
 * module installs itself on import, so each test loads it fresh against fake
 * `ErrorUtils` / `HermesInternal` globals with `__DEV__` false.
 */

export {}; // a module, so its helpers do not share the global scope with other suites

type Handler = (error: Error, isFatal?: boolean) => void;
interface TrackerOptions {
  onUnhandled: (id: number, rejection: unknown) => void;
  onHandled: (id: number) => void;
}

// Safe: jest's global stands in for the RN runtime; only this test and the module
// under test touch these keys, and afterAll deletes them.
const runtime = globalThis as unknown as {
  __DEV__: boolean;
  ErrorUtils?: {getGlobalHandler: () => Handler; setGlobalHandler: (handler: Handler) => void};
  HermesInternal?: {enablePromiseRejectionTracker?: (options: TrackerOptions) => void};
};

const load = (withTracker: boolean) => {
  const defaultHandler = jest.fn<void, [Error, boolean?]>();
  let installed: Handler | undefined;
  let tracker: TrackerOptions | undefined;
  runtime.ErrorUtils = {getGlobalHandler: () => defaultHandler, setGlobalHandler: handler => (installed = handler)};
  runtime.HermesInternal = withTracker ? {enablePromiseRejectionTracker: options => (tracker = options)} : {};
  // The handler and the log must share one module set (one MMKV mock store).
  let log: typeof import('../../../src/platform/errorLog') | undefined;
  jest.isolateModules(() => {
    log = require('../../../src/platform/errorLog') as typeof import('../../../src/platform/errorLog'); // the cast names the module's own type
    require('../../../src/platform/globalErrorHandler');
  });
  const entries = () => log?.getErrorLog() ?? [];
  return {defaultHandler, installed, tracker, entries};
};

const savedDev = runtime.__DEV__;
beforeEach(() => {
  runtime.__DEV__ = false;
});
afterAll(() => {
  runtime.__DEV__ = savedDev;
  delete runtime.ErrorUtils;
  delete runtime.HermesInternal;
});

it('logs a fatal error and still hands it to React Native (never swallowed)', () => {
  const {defaultHandler, installed, entries} = load(true);
  installed?.(new Error('boom'), true);
  expect(entries().map(e => [e.message, e.fatal])).toEqual([['boom', true]]);
  expect(defaultHandler).toHaveBeenCalledTimes(1);
});

it('logs a non-fatal error and keeps it off the screen', () => {
  const {defaultHandler, installed, entries} = load(true);
  installed?.(new Error('minor'), false);
  expect(entries().map(e => e.message)).toEqual(['minor']);
  expect(defaultHandler).not.toHaveBeenCalled();
});

it('records unhandled rejections, and stops asking about one handled later', () => {
  const {tracker, entries} = load(true);
  tracker?.onUnhandled(1, new Error('nobody caught me'));
  expect(entries()[0]?.unhandled).toBe(true);
  tracker?.onHandled(1);
  expect(entries()[0]?.unhandled).toBe(false);
});

it('says so in the log when the runtime has no rejection tracker', () => {
  const {entries} = load(false);
  expect(entries().map(e => e.message)).toEqual([
    'Promise rejection tracker unavailable: unhandled rejections are not recorded',
  ]);
});
