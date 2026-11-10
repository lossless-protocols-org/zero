/**
 * Centralized data sanitization — single source of truth.
 * All services use this to clean values on read AND write.
 * Handles legacy poisoned data: "null", "", "undefined", null, undefined.
 */

const POISONED_VALUES = new Set(['null', 'undefined', '']);

export const sanitizeString = (val: string | null | undefined, fallback: string): string => {
  if (val == null || POISONED_VALUES.has(val)) {
    return fallback;
  }
  return val;
};

export const isPoisonedValue = (val: string | null | undefined): boolean => {
  return val == null || POISONED_VALUES.has(val);
};

export const DEFAULTS = {
  icon: '',
  color: '#758595',
  type: 'Person', // a new debtor is a person (domain/debtType.debtorGroupOf)
} as const;
