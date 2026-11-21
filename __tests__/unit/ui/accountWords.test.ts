/** The words the held-and-owed model shows: a class's one word, and the label an account's kind is shown under. */
import type {TFunction} from 'i18next';
import {CLASS_ICON, CLASS_LABEL, CLASS_MEANING, formatBalance, kindLabelOf} from '../../../src/ui/accountWords';
import {ACCOUNT_CLASSES} from '../../../src/domain/accounts';

// The keys themselves stand in for the words: what is under test is which key is asked for.
const t = ((key: string) => key) as unknown as TFunction;

it('every class has its word, its meaning and its icon', () => {
  for (const accountClass of ACCOUNT_CLASSES) {
    expect(CLASS_LABEL[accountClass]).toMatch(/^accounts\.class/);
    expect(CLASS_MEANING[accountClass]).toMatch(/^accounts\.means/);
    expect(CLASS_ICON[accountClass]).not.toBe('');
  }
});

it('a kind is the user’s own word, else the word its stored type stands for, else none', () => {
  expect(kindLabelOf({type: 'bank', kind: '  Salary  '}, t)).toBe('Salary');
  expect(kindLabelOf({type: 'bank', kind: ''}, t)).toBe('accounts.typeBank');
  expect(kindLabelOf({type: 'cash', kind: ''}, t)).toBe('accounts.typeCash');
  expect(kindLabelOf({type: 'wallet', kind: ''}, t)).toBe('accounts.typeWallet');
  expect(kindLabelOf({type: 'card', kind: ''}, t)).toBe('accounts.kindCredit');
  expect(kindLabelOf({type: 'card', kind: 'Later'}, t)).toBe('Later');
  expect(kindLabelOf({type: 'loan', kind: ''}, t)).toBe('');
  expect(kindLabelOf({type: 'investment', kind: ''}, t)).toBe('');
  expect(kindLabelOf({type: 'other', kind: ''}, t)).toBe('');
});

it('a balance below zero reads with a minus sign', () => {
  const format = (n: number) => `₹${n}`;
  expect(formatBalance(format, -200)).toBe('−₹200');
  expect(formatBalance(format, 200)).toBe('₹200');
  expect(formatBalance(format, 0)).toBe('₹0');
});
