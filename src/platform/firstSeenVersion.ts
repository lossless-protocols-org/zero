import {StorageService} from './storage';
import {getAppVersion} from './getVersion';

/** MMKV key read by 3.0 (the thank-you price for anyone first seen below 3.0). */
const FIRST_SEEN_VERSION_KEY = 'firstSeenAppVersion';

/**
 * The last version that did not record this value (2.8 was the first that did).
 * An install that already holds data and has no value is therefore at most this old.
 */
const LAST_VERSION_WITHOUT_IT = '2.7.1';

/**
 * The pre-3.0 flag (2.8, plan §5.6): the version of zero this install first
 * ran, written once and never changed. It survives updates and "Delete all
 * data" (which resets only named preferences), not a reinstall (accepted).
 * An install that already had data before 2.8 records 2.8.x, which is still
 * below 3.0, the only thing 3.0 asks.
 *
 * `hadDataAlready` covers the install that skips 2.8: it updates from 2.7.1
 * or older straight to a later version, so it has rows but no value. Without
 * this it would record the version it updated TO, and someone who has used
 * zero for years would look like a new install (3.0's thank-you price asks
 * exactly this). Called once the database has opened, which is the only time
 * that is known. Returns the stored version.
 */
/** The recorded value, or null on an install that has not opened its database yet. */
export const getFirstSeenVersion = (): string | null => StorageService.getItemSync(FIRST_SEEN_VERSION_KEY);

export const recordFirstSeenVersion = (hadDataAlready: boolean): string => {
  const stored = StorageService.getItemSync(FIRST_SEEN_VERSION_KEY);
  if (stored) {
    return stored;
  }
  const first = hadDataAlready ? LAST_VERSION_WITHOUT_IT : getAppVersion();
  StorageService.setItemSync(FIRST_SEEN_VERSION_KEY, first);
  return first;
};
