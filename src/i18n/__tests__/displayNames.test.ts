/**
 * M32 (v2.7.1): seeded names are stored in English (backups match on them),
 * so they are translated where they are shown, keyed by the stored English
 * text. A name the user typed is shown as typed.
 */

import i18n from '..';
import {
  SETTLEMENT_DESCRIPTION,
  displayCategoryName,
  displayDebtAccountName,
  displayDebtDescription,
  displayUserName,
} from '../displayNames';

const TEST_LANGUAGE = 'xx';

beforeAll(async () => {
  i18n.addResourceBundle(TEST_LANGUAGE, 'translation', {
    defaultCategories: {food: 'Essen', other: 'Sonstiges'},
    defaultDebtAccounts: {creditCard: 'Kreditkarte', other: 'Andere'},
    common: {unknown: 'Unbekannt', defaultUserName: 'Nutzer'},
    debts: {settlementDescription: 'Ausgeglichen'},
  });
  await i18n.changeLanguage(TEST_LANGUAGE);
});

afterAll(async () => {
  await i18n.changeLanguage('en');
});

const t = i18n.t.bind(i18n);

describe('displayCategoryName', () => {
  it('translates a seeded category by its English name', () => {
    expect(displayCategoryName('Food', t)).toBe('Essen');
    expect(displayCategoryName('Other', t)).toBe('Sonstiges');
  });

  it('translates the Unknown placeholder from a backup', () => {
    expect(displayCategoryName('Unknown', t)).toBe('Unbekannt');
  });

  it('shows a name the user typed as typed', () => {
    expect(displayCategoryName('Groceries', t)).toBe('Groceries');
    expect(displayCategoryName('food', t)).toBe('food');
  });

  it('does not treat object keys as names', () => {
    expect(displayCategoryName('toString', t)).toBe('toString');
    expect(displayCategoryName('constructor', t)).toBe('constructor');
  });
});

describe('displayDebtAccountName', () => {
  it('translates a seeded account type', () => {
    expect(displayDebtAccountName('Credit Card', t)).toBe('Kreditkarte');
    expect(displayDebtAccountName('Other', t)).toBe('Andere');
    expect(displayDebtAccountName('Savings', t)).toBe('Savings');
  });
});

describe('displayUserName', () => {
  it('translates the placeholder name and keeps a real one', () => {
    expect(displayUserName('User', t)).toBe('Nutzer');
    expect(displayUserName('Ravi', t)).toBe('Ravi');
    expect(displayUserName(undefined, t)).toBe('');
  });
});

describe('displayDebtDescription', () => {
  it('translates the settlement marker and keeps other text', () => {
    expect(SETTLEMENT_DESCRIPTION).toBe('Settled up');
    expect(displayDebtDescription(SETTLEMENT_DESCRIPTION, t)).toBe('Ausgeglichen');
    expect(displayDebtDescription('Dinner', t)).toBe('Dinner');
  });
});
