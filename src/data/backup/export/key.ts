import {nanoid} from 'nanoid';

/**
 * The provenance marker stored as `key` in every export envelope.
 *
 * It is NOT a secret and NOT a checksum — it only says "a zero build wrote
 * this file". Validation must stay as permissive as that purpose allows,
 * because a false negative here makes a user's only backup unimportable,
 * which is the worst outcome this app has.
 *
 * Lives in data/backup/export (pure, no react-native imports) rather than
 * beside the device code so the generator and the validator are unit-testable under
 * both test runners — the drift below went unnoticed precisely because
 * nothing could test it.
 */
/** @internal test */
export const EXPORT_KEY_PREFIX = 'zero';
/** @internal test */
export const EXPORT_KEY_LENGTH = 20;

export const generateUniqueKey = (): string => {
  return `${EXPORT_KEY_PREFIX}${nanoid(16)}`;
};

/**
 * The body MUST accept nanoid's full URL-safe alphabet (A-Za-z0-9_-).
 *
 * It previously required /^[a-zA-Z0-9]+$/, which rejected any key containing
 * `_` or `-` — roughly 39% of every backup this app has ever written. The
 * failure surfaced only at restore time, as "invalid key", with no telemetry
 * to report it. The hand-authored fixtures in references/ are all accidentally
 * alphanumeric, so no test caught it either.
 *
 * Never narrow this again without changing generateUniqueKey AND shipping an
 * upgrader for files already in users' hands.
 */
const EXPORT_KEY_BODY = /^[A-Za-z0-9_-]+$/;

export const isValidExportKey = (key: string | null | undefined): boolean => {
  if (!key || key.length !== EXPORT_KEY_LENGTH) {
    return false;
  }
  if (!key.startsWith(EXPORT_KEY_PREFIX)) {
    return false;
  }
  return EXPORT_KEY_BODY.test(key.slice(EXPORT_KEY_PREFIX.length));
};
