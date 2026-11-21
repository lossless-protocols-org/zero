/**
 * The passphrase rules for the automatic backup (3.0, plan P10). Long enough
 * that a stolen file is not opened by guessing: with 600,000 PBKDF2 rounds
 * per guess, eight characters of any kind put a phone-speed search out of
 * reach. Spaces count and nothing is trimmed: the passphrase is used exactly
 * as typed (normalised to NFC by the native side).
 */
export const MIN_PASSPHRASE_LENGTH = 8;

export type PassphraseProblem = 'tooShort' | 'mismatch';

/** What is wrong with a passphrase typed twice, or null when it can be used. Counts characters, not UTF-16 units. */
export const passphraseProblem = (first: string, second: string): PassphraseProblem | null => {
  if ([...first].length < MIN_PASSPHRASE_LENGTH) {
    return 'tooShort';
  }
  return first === second ? null : 'mismatch';
};
