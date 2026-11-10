import {StorageService} from './storage';
import {getAppVersion} from './getVersion';

/** MMKV key read by 3.0 (ZERO_3.0_PRO.md: the ₹299 offer for anyone first seen below 3.0). */
const FIRST_SEEN_VERSION_KEY = 'firstSeenAppVersion';

/**
 * The pre-3.0 flag (2.8, plan §5.6): the version of zero this install first
 * ran, written once and never changed. It survives updates and "Delete all
 * data" (which resets only named preferences), not a reinstall (accepted).
 * An install that already had data before 2.8 records 2.8.x, which is still
 * below 3.0, the only thing 3.0 asks. Returns the stored version.
 */
export const recordFirstSeenVersion = (): string => {
  const stored = StorageService.getItemSync(FIRST_SEEN_VERSION_KEY);
  if (stored) {
    return stored;
  }
  const current = getAppVersion();
  StorageService.setItemSync(FIRST_SEEN_VERSION_KEY, current);
  return current;
};
