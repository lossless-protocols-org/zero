import {sanitizeString, isPoisonedValue, DEFAULTS} from '../sanitize';

describe('sanitizeString', () => {
  it('returns fallback for null', () => {
    expect(sanitizeString(null, DEFAULTS.icon)).toBe(DEFAULTS.icon);
  });

  it('returns fallback for undefined', () => {
    expect(sanitizeString(undefined, DEFAULTS.color)).toBe(DEFAULTS.color);
  });

  it('returns fallback for literal "null" string', () => {
    expect(sanitizeString('null', DEFAULTS.icon)).toBe(DEFAULTS.icon);
  });

  it('returns fallback for literal "undefined" string', () => {
    expect(sanitizeString('undefined', DEFAULTS.color)).toBe(DEFAULTS.color);
  });

  it('returns fallback for empty string', () => {
    expect(sanitizeString('', DEFAULTS.type)).toBe(DEFAULTS.type);
  });

  it('returns actual value for valid string', () => {
    expect(sanitizeString('shopping-cart', DEFAULTS.icon)).toBe('shopping-cart');
  });

  it('returns actual value for valid color hex', () => {
    expect(sanitizeString('#FF5733', DEFAULTS.color)).toBe('#FF5733');
  });
});

describe('isPoisonedValue', () => {
  it.each([null, undefined, 'null', 'undefined', ''])('returns true for %p', val => {
    expect(isPoisonedValue(val)).toBe(true);
  });

  it.each(['valid', '#000', 'Person'])('returns false for %p', val => {
    expect(isPoisonedValue(val)).toBe(false);
  });
});
