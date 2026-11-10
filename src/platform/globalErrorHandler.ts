import {appendErrorLog, markRejectionHandled, recordUnhandledRejection} from './errorLog';

// Read through `typeof`: React Native declares the global, but a test or
// headless runtime may not install it, and a bare read would throw.
const errorUtils = typeof ErrorUtils === 'undefined' ? undefined : ErrorUtils;

/** Hermes' rejection tracker. React Native types `HermesInternal` only as `null | {}`. */
interface RejectionTracker {
  enablePromiseRejectionTracker: (options: {
    allRejections: boolean;
    onUnhandled: (id: number, rejection: unknown) => void;
    onHandled: (id: number) => void;
  }) => void;
}

const hasRejectionTracker = (hermes: unknown): hermes is RejectionTracker =>
  typeof hermes === 'object' &&
  hermes !== null &&
  'enablePromiseRejectionTracker' in hermes &&
  typeof hermes.enablePromiseRejectionTracker === 'function';

const defaultHandler = errorUtils?.getGlobalHandler();

errorUtils?.setGlobalHandler((error: Error, isFatal?: boolean) => {
  appendErrorLog(error, !!isFatal);

  if (__DEV__) {
    console.error('[GlobalErrorHandler]', isFatal ? 'FATAL' : 'NON-FATAL', error);
    defaultHandler?.(error, isFatal);
    return;
  }

  // Non-fatal errors are recorded and swallowed on purpose: they are already
  // captured above, and letting RN surface them in production would show a
  // red box over a finance app for a recoverable problem.
  if (!isFatal) {
    return;
  }

  // Fatals ALWAYS go to the default handler. Swallowing them (as this used
  // to do on Android) left the app running in an undefined state with no
  // crash and no restart — strictly worse than crashing.
  defaultHandler?.(error, isFatal);
});

/**
 * Unhandled promise rejections.
 *
 * `globalThis.onunhandledrejection` is a web API and never fires under Hermes.
 * React Native installs Hermes' own tracker, but only inside `if (__DEV__)`
 * (Libraries/Core/polyfillPromise.js) — so in production, rejections were
 * silently lost. Install our own tracker for release builds only, which
 * therefore cannot clash with RN's dev one.
 */
const MAX_TRACKED_REJECTIONS = 100;

const hermes = typeof HermesInternal === 'undefined' ? undefined : HermesInternal;
if (!__DEV__ && hasRejectionTracker(hermes)) {
  const loggedAt = new Map<number, string>();
  hermes.enablePromiseRejectionTracker({
    allRejections: true,
    onUnhandled: (id: number, rejection: unknown) => {
      loggedAt.set(id, recordUnhandledRejection(rejection));
      // Rejections never handled stay here; keep the map bounded (the log itself holds 20).
      const oldest = loggedAt.size > MAX_TRACKED_REJECTIONS ? loggedAt.keys().next().value : undefined;
      if (oldest !== undefined) {
        loggedAt.delete(oldest);
      }
    },
    onHandled: (id: number) => {
      // Handled after all: keep the entry as a record, but do not ask about it.
      const timestamp = loggedAt.get(id);
      loggedAt.delete(id);
      if (timestamp) {
        markRejectionHandled(timestamp);
      }
    },
  });
} else if (!__DEV__) {
  // Without the tracker, release builds would lose every unhandled rejection
  // silently; leave one line in Diagnostics saying so.
  appendErrorLog(new Error('Promise rejection tracker unavailable: unhandled rejections are not recorded'), false);
}
