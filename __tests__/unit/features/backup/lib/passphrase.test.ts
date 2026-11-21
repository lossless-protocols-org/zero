/** The passphrase rules (P10): eight characters at least, counted as characters, and typed the same twice. */
import {MIN_PASSPHRASE_LENGTH, passphraseProblem} from '../../../../../src/features/backup/lib/passphrase';

it('needs eight characters, counting each character once whatever its encoding', () => {
  expect(MIN_PASSPHRASE_LENGTH).toBe(8);
  expect(passphraseProblem('seven77', 'seven77')).toBe('tooShort');
  expect(passphraseProblem('eight888', 'eight888')).toBeNull();
  // Four emoji are eight UTF-16 units but four characters: too short.
  expect(passphraseProblem('😀😀😀😀', '😀😀😀😀')).toBe('tooShort');
});

it('must be typed the same twice; spaces count and nothing is trimmed', () => {
  expect(passphraseProblem('correct horse', 'correct horse ')).toBe('mismatch');
  expect(passphraseProblem('correct horse', 'correct horse')).toBeNull();
});
