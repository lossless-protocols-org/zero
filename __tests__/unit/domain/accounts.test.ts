/** Account rules every layer shares (3.0): types read neutrally, names compared as backups compare them, lines and kinds by type. */
import {
  ACCOUNT_CLASSES,
  ACCOUNT_KIND_MAX,
  ACCOUNT_TYPES,
  accountKindKey,
  accountNameKey,
  builtInKindOf,
  canPayFrom,
  checkpointKindFor,
  classOf,
  cleanAccountKind,
  cleanAccountName,
  isOwedType,
  isValidAccountKind,
  isValidAccountName,
  positionLineOf,
  sideOf,
  storedTypeFor,
  toAccountType,
  toCheckpointKind,
} from '../../../src/domain/accounts';

it('reads unknown stored values neutrally', () => {
  expect(toAccountType('bank')).toBe('bank');
  expect(toAccountType('Savings')).toBe('other');
  expect(toCheckpointKind('revaluation')).toBe('revaluation');
  expect(toCheckpointKind('x')).toBe('adjustment');
});

it('two names that read the same are one name', () => {
  expect(accountNameKey(' HDFC ')).toBe(accountNameKey('hdfc'));
  expect(accountNameKey('HDFC')).not.toBe(accountNameKey('HDFC2'));
  expect(cleanAccountName('  Amex ')).toBe('Amex');
});

it('a name is something, and no longer than a backup row carries', () => {
  expect(isValidAccountName('   ')).toBe(false);
  expect(isValidAccountName('x'.repeat(200))).toBe(true);
  expect(isValidAccountName('x'.repeat(201))).toBe(false);
});

it('an investment’s gap is a revaluation, any other an adjustment; a card below zero is owed', () => {
  expect(checkpointKindFor('investment')).toBe('revaluation');
  expect(checkpointKindFor('card')).toBe('adjustment');
  expect(positionLineOf('card', -1)).toBe('youOwe');
  // Paid beyond nothing, the lender owes you: never money in hand (approved model A2).
  expect(positionLineOf('card', 0)).toBe('owedToYou');
  expect(positionLineOf('card', 300)).toBe('owedToYou');
  expect(positionLineOf('loan', -1)).toBe('youOwe');
  expect(positionLineOf('loan', 1)).toBe('owedToYou');
  expect(positionLineOf('bank', -1)).toBe('cashAndBank');
  expect(positionLineOf('investment', -1)).toBe('investments');
});

describe('held and owed (approved model A2)', () => {
  it('every stored type is one of four classes, and a class is held or owed', () => {
    expect(ACCOUNT_TYPES.map(type => [type, classOf(type)])).toEqual([
      ['cash', 'spend'],
      ['bank', 'spend'],
      ['card', 'card'],
      ['wallet', 'spend'],
      ['investment', 'save'],
      ['other', 'spend'],
      ['loan', 'loan'],
    ]);
    expect(ACCOUNT_CLASSES.map(sideOf)).toEqual(['held', 'held', 'owed', 'owed']);
    expect(isOwedType('loan')).toBe(true);
    expect(isOwedType('bank')).toBe(false);
  });

  it('an unknown stored type reads as other, which is money to spend', () => {
    expect(classOf(toAccountType('brokerage'))).toBe('spend');
    expect(toAccountType('loan')).toBe('loan');
  });

  it('an entry is paid from money to spend or a card, never a loan or savings', () => {
    expect(ACCOUNT_TYPES.filter(canPayFrom)).toEqual(['cash', 'bank', 'card', 'wallet', 'other']);
  });

  it('the stored type follows the class and, for money to spend, the kind', () => {
    expect(storedTypeFor('card', 'Later')).toBe('card');
    expect(storedTypeFor('loan', '')).toBe('loan');
    expect(storedTypeFor('save', 'Gold')).toBe('investment');
    expect(storedTypeFor('spend', '')).toBe('bank');
    expect(storedTypeFor('spend', ' cash ')).toBe('cash');
    expect(storedTypeFor('spend', 'WALLET')).toBe('wallet');
    expect(storedTypeFor('spend', 'GCash')).toBe('bank');
  });

  it('a kind is one short label: cleaned, compared without case, bounded', () => {
    expect(cleanAccountKind('  Pay   later ')).toBe('Pay later');
    expect(accountKindKey('GOLD ')).toBe('gold');
    expect(isValidAccountKind('')).toBe(true);
    expect(isValidAccountKind('x'.repeat(ACCOUNT_KIND_MAX))).toBe(true);
    expect(isValidAccountKind('x'.repeat(ACCOUNT_KIND_MAX + 1))).toBe(false);
    expect(builtInKindOf('card')).toBe('credit');
    expect(builtInKindOf('wallet')).toBe('wallet');
    expect(builtInKindOf('loan')).toBeNull();
    expect(builtInKindOf('investment')).toBeNull();
  });
});
