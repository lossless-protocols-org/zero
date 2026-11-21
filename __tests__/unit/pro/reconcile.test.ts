/**
 * Effects follow the entitlement that is true now (3.0 law L4): every
 * producer is told on every pass, a failure in one stops nothing, and a pass
 * cut short is simply run again. Nothing depends on having seen the moment
 * the entitlement changed.
 */
import {NO_ENTITLEMENT} from '../../../src/pro/entitlement';
import {reconcile, registerProducer} from '../../../src/pro/reconcile';
import type {Entitlement} from '../../../src/pro/schema';
import {clearErrorLog, getErrorLog} from '../../../src/platform/errorLog';

const LIFETIME: Entitlement = {...NO_ENTITLEMENT, state: 'lifetime', productId: 'zero_pro_lifetime'};
const EXPIRED: Entitlement = {...NO_ENTITLEMENT, state: 'expired', productId: 'zero_pro', endedAtMs: 1};

const removers: Array<() => void> = [];
const register = (key: string, sync: (entitlement: Entitlement) => void | Promise<void>): void => {
  removers.push(registerProducer({key, sync}));
};

beforeEach(() => {
  clearErrorLog();
});

afterEach(() => {
  removers.splice(0).forEach(remove => remove());
});

it('resolves with nothing registered', async () => {
  await expect(reconcile(LIFETIME)).resolves.toBeUndefined();
});

it('tells every producer the entitlement, every time, changed or not', async () => {
  const seen: string[] = [];
  register('recurring', entitlement => {
    seen.push(`recurring ${entitlement.state}`);
  });
  register('backup', async entitlement => {
    seen.push(`backup ${entitlement.state}`);
  });
  await reconcile(LIFETIME);
  await reconcile(LIFETIME);
  expect(seen).toEqual(['recurring lifetime', 'backup lifetime', 'recurring lifetime', 'backup lifetime']);
});

it('keeps going when one producer fails, logs it, and tries it again on the next pass', async () => {
  let attempts = 0;
  const done: string[] = [];
  register('reminders', () => {
    attempts += 1;
    if (attempts === 1) {
      throw new Error('alarm service unavailable');
    }
    done.push('reminders');
  });
  register('widget', async () => {
    if (attempts === 1) {
      await Promise.reject('disk full'); // a producer may fail with anything
    }
    done.push('widget');
  });
  register('backup', () => {
    done.push('backup');
  });

  await reconcile(EXPIRED);
  expect(done).toEqual(['backup']);
  expect(getErrorLog().map(entry => entry.message)).toEqual(
    expect.arrayContaining(['reconcile reminders: alarm service unavailable', 'reconcile widget: disk full']),
  );

  await reconcile(EXPIRED);
  expect(done).toEqual(['backup', 'reminders', 'widget', 'backup']);
});

it('runs one pass at a time, and follows a pass with exactly one more for the latest entitlement', async () => {
  const seen: string[] = [];
  let active = 0;
  let mostAtOnce = 0;
  let release: () => void = () => {};
  const firstPassHeld = new Promise<void>(resolve => {
    release = resolve;
  });
  register('slow', async entitlement => {
    active += 1;
    mostAtOnce = Math.max(mostAtOnce, active);
    seen.push(entitlement.state);
    if (seen.length === 1) {
      await firstPassHeld;
    }
    active -= 1;
  });

  const first = reconcile(LIFETIME);
  // Three changes arrive while the first pass is still running.
  const second = reconcile(EXPIRED);
  const third = reconcile(LIFETIME);
  const fourth = reconcile(NO_ENTITLEMENT);
  expect(second).toBe(first);
  expect(third).toBe(first);
  expect(fourth).toBe(first);
  release();
  await first;

  expect(seen).toEqual(['lifetime', 'none']);
  expect(mostAtOnce).toBe(1);
  // And the next call starts a pass of its own.
  await reconcile(EXPIRED);
  expect(seen).toEqual(['lifetime', 'none', 'expired']);
});

it('does not drop a call that arrives just as a pass is finishing', async () => {
  const seen: string[] = [];
  let late: Promise<void> | undefined;
  register('only', entitlement => {
    seen.push(entitlement.state);
    if (seen.length === 1) {
      // Two microtasks on: after the pass has taken its last look for a waiting call, and
      // before it has marked itself finished.
      queueMicrotask(() =>
        queueMicrotask(() => {
          late = reconcile(EXPIRED);
        }),
      );
    }
  });
  await reconcile(LIFETIME);
  await late;
  expect(seen).toEqual(['lifetime', 'expired']);
  // Nothing stale is left behind to run after a later call.
  await reconcile(NO_ENTITLEMENT);
  expect(seen).toEqual(['lifetime', 'expired', 'none']);
});

it('replaces a producer registered again under the same key, and removes only its own', async () => {
  const seen: string[] = [];
  const saying = (word: string) => () => {
    seen.push(word);
  };
  const removeOld = registerProducer({key: 'backup', sync: saying('old')});
  const removeNew = registerProducer({key: 'backup', sync: saying('new')});
  removers.push(removeNew);
  await reconcile(LIFETIME);
  expect(seen).toEqual(['new']);

  removeOld(); // the old one is already gone; the new one must stay
  await reconcile(LIFETIME);
  expect(seen).toEqual(['new', 'new']);

  removeNew();
  await reconcile(LIFETIME);
  expect(seen).toEqual(['new', 'new']);
});
