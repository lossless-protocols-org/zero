/**
 * Checkpoints (schema v6, 3.0): an account's balance on a day. A balance and
 * its gap may be negative (a card), never NaN or absurd; the kind is one of
 * two; the account is the user's. Real LokiJS database.
 */
import {database} from '../../../../src/data/database/database';
import type {Checkpoint} from '../../../../src/data/database/models/Checkpoint';
import {defaultAccountId} from '../../../../src/data/database/defaultAccount';
import {
  CheckpointRuleError,
  createCheckpoint,
  deleteCheckpoint,
  updateCheckpoint,
} from '../../../../src/data/services/checkpointService';
import {toCheckpointKind} from '../../../../src/domain/accounts';
import * as services from '../../../harness/services';

let userId = '';
let cash = '';

const input = (more: Partial<Parameters<typeof createCheckpoint>[1]> = {}) => ({
  accountId: cash,
  balance: -1200.5,
  date: '2026-11-08' as const,
  gap: -30.25,
  kind: 'adjustment' as const,
  note: 'statement',
  ...more,
});

const rule = async (write: Promise<unknown>): Promise<string> => {
  try {
    await write;
  } catch (error) {
    if (error instanceof CheckpointRuleError) {
      return error.rule;
    }
    throw error;
  }
  return 'accepted';
};

const stored = async () => (await database.get<Checkpoint>('checkpoints').query().fetch()).map(c => c._raw);

beforeEach(async () => {
  await services.deleteAllData();
  userId = await services.createUser('Asha', '');
  cash = defaultAccountId(userId);
});

it('records a balance, negative included', async () => {
  const id = await createCheckpoint(userId, input());
  expect(await stored()).toEqual([
    expect.objectContaining({
      id,
      account_id: cash,
      balance: -1200.5,
      gap: -30.25,
      kind: 'adjustment',
      date: '2026-11-08',
    }),
  ]);
});

it.each([
  ['notADay', {date: '8 Nov' as never}],
  ['notAnAmount', {balance: Number.POSITIVE_INFINITY}],
  ['notAnAmount', {balance: Number.NaN}],
  ['notAnAmount', {gap: 1e14}],
  ['notAKind', {kind: 'income' as never}],
  ['notTheUsersAccount', {accountId: 'nowhere'}],
  ['noteTooLong', {note: 'x'.repeat(201)}],
] as const)('refuses %s, and stores nothing', async (expected, more) => {
  expect(await rule(createCheckpoint(userId, input(more)))).toBe(expected);
  expect(await stored()).toEqual([]);
});

it('an edit is checked as the checkpoint it would leave, and refused whole', async () => {
  const id = await createCheckpoint(userId, input());
  expect(await rule(updateCheckpoint(id, {kind: 'gain' as never, note: 'never stored'}))).toBe('notAKind');
  expect(await stored()).toEqual([expect.objectContaining({kind: 'adjustment', note: 'statement'})]);
  await updateCheckpoint(id, {kind: 'revaluation'});
  expect(await stored()).toEqual([expect.objectContaining({kind: 'revaluation'})]);
});

it('deletes', async () => {
  const id = await createCheckpoint(userId, input());
  await deleteCheckpoint(id);
  expect(await stored()).toEqual([]);
});

it('reads a stored kind it does not know as an adjustment, the neutral reading', () => {
  expect(toCheckpointKind('revaluation')).toBe('revaluation');
  expect(toCheckpointKind('adjustment')).toBe('adjustment');
  expect(toCheckpointKind('')).toBe('adjustment');
  expect(toCheckpointKind('gain')).toBe('adjustment');
});

it('cannot be recorded without a user', async () => {
  await expect(createCheckpoint('', input())).rejects.toThrow('user id is empty');
});
