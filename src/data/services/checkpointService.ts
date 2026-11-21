import {database} from '../database/database';
import {Checkpoint} from '../database/models/Checkpoint';
import {assertUserId} from './assertUserId';
import {isUsersAccount} from './accountService';
import {getAccountBalance} from './netWorthService';
import {checkpointKindFor} from '../../domain/accounts';
import {fromMoneyUnits, toMoneyUnits} from '../../domain/money';
import {isCalendarDay} from '../../domain/dates';
import {MAX_AMOUNT, MAX_TEXT} from '../../domain/limits';
import type {CheckpointKind, IsoDay} from '../../domain/types';

/**
 * An account's balance on a day, as the user read it (schema v6, 3.0): the
 * anchor balances after it are computed from (ZERO_SYSTEM_DESIGN.md §4.4).
 * It never changes another row. Reconciling is `previewCheckpoint` then
 * `acceptCheckpoint`; balances read it (netWorthService).
 */

type CheckpointRule = 'notADay' | 'notTheUsersAccount' | 'notAnAmount' | 'notAKind' | 'noteTooLong';

/**
 * A write refused because it would store an invalid checkpoint. The UI maps `rule` to copy.
 * @internal The reconcile screen arrives with plan P8; the tests use it now.
 */
export class CheckpointRuleError extends Error {
  readonly rule: CheckpointRule;
  constructor(rule: CheckpointRule) {
    super(`Checkpoint rule broken: ${rule}`);
    this.name = 'CheckpointRuleError';
    this.rule = rule;
  }
}

const KINDS: readonly CheckpointKind[] = ['revaluation', 'adjustment'];

interface CheckpointFields {
  accountId: string;
  balance: number;
  date: string;
  gap: number;
  kind: string;
  note: string;
}

/** Within the backup's own bound either way (domain/limits): a row past it would stop every later export. */
const isAmount = (value: number): boolean => Number.isFinite(value) && Math.abs(value) <= MAX_AMOUNT;

const assertCheckpointFields = async (userId: string, fields: CheckpointFields): Promise<void> => {
  if (!isCalendarDay(fields.date)) {
    throw new CheckpointRuleError('notADay');
  }
  // A balance may be negative (a card); it may not be NaN, infinite or absurd.
  if (!isAmount(fields.balance) || !isAmount(fields.gap)) {
    throw new CheckpointRuleError('notAnAmount');
  }
  if (!KINDS.includes(fields.kind as CheckpointKind)) {
    throw new CheckpointRuleError('notAKind');
  }
  if (fields.note.length > MAX_TEXT) {
    throw new CheckpointRuleError('noteTooLong');
  }
  if (!(await isUsersAccount(userId, fields.accountId))) {
    throw new CheckpointRuleError('notTheUsersAccount');
  }
};

/**
 * Records a checkpoint.
 * @internal The reconcile screen arrives with plan P8; the tests use it now.
 */
export const createCheckpoint = async (
  userId: string,
  input: {accountId: string; balance: number; date: IsoDay; gap: number; kind: CheckpointKind; note: string},
): Promise<string> => {
  assertUserId(userId, 'checkpoint');
  let id = '';
  await database.write(async () => {
    await assertCheckpointFields(userId, input);
    const checkpoint = await database.get<Checkpoint>('checkpoints').create(c => {
      c.userId = userId;
      c.accountId = input.accountId;
      c.balance = input.balance;
      c.date = input.date;
      c.gap = input.gap;
      c.kind = input.kind;
      c.note = input.note;
    });
    id = checkpoint.id;
  });
  return id;
};

/**
 * Changes the fields given and no other (law L6). The result must still be a valid checkpoint.
 * @internal The reconcile screen arrives with plan P8; the tests use it now.
 */
export const updateCheckpoint = async (
  checkpointId: string,
  patch: {accountId?: string; balance?: number; date?: IsoDay; gap?: number; kind?: CheckpointKind; note?: string},
): Promise<void> => {
  await database.write(async () => {
    const checkpoint = await database.get<Checkpoint>('checkpoints').find(checkpointId);
    await assertCheckpointFields(checkpoint.userId, {
      accountId: patch.accountId ?? checkpoint.accountId,
      balance: patch.balance ?? checkpoint.balance,
      date: patch.date ?? checkpoint.date,
      gap: patch.gap ?? checkpoint.gap,
      kind: patch.kind ?? checkpoint.kind,
      note: patch.note ?? checkpoint.note,
    });
    await checkpoint.update(c => {
      if (patch.accountId !== undefined) {
        c.accountId = patch.accountId;
      }
      if (patch.balance !== undefined) {
        c.balance = patch.balance;
      }
      if (patch.date !== undefined) {
        c.date = patch.date;
      }
      if (patch.gap !== undefined) {
        c.gap = patch.gap;
      }
      if (patch.kind !== undefined) {
        c.kind = patch.kind;
      }
      if (patch.note !== undefined) {
        c.note = patch.note;
      }
    });
  });
};

/** Deletes a checkpoint: the account's balance after it is read from the anchor before it again. */
export const deleteCheckpoint = async (checkpointId: string): Promise<void> => {
  await database.write(async () => {
    const checkpoint = await database.get<Checkpoint>('checkpoints').find(checkpointId);
    await checkpoint.destroyPermanently();
  });
};

/** What reconciling would record: the balance the rows give on the day, and how far the typed balance is from it. */
export interface CheckpointPreview {
  derived: number;
  gap: number;
}

const previewIn = async (userId: string, accountId: string, balance: number, date: IsoDay) => {
  const account = await getAccountBalance(userId, accountId, date);
  const derived = account.balance;
  return {type: account.type, derived, gap: fromMoneyUnits(toMoneyUnits(balance) - toMoneyUnits(derived))};
};

/** The balance zero works out for the end of `date`, and the gap to `balance` (positive: more than zero thought). */
export const previewCheckpoint = async (
  userId: string,
  accountId: string,
  balance: number,
  date: IsoDay,
): Promise<CheckpointPreview> => {
  const {derived, gap} = await previewIn(userId, accountId, balance, date);
  return {derived, gap};
};

/**
 * Records what the user read as the account's balance at the end of `date`
 * (ZERO_3.0_PRO.md §5). The gap is worked out again inside the write, so it
 * is the gap against the rows as they are at that moment, and the kind
 * follows the account: a value change on an investment (R15), an adjustment
 * on any other. From then on the account's balance after that day starts here.
 */
export const acceptCheckpoint = async (
  userId: string,
  input: {accountId: string; balance: number; date: IsoDay; note: string},
): Promise<{id: string; gap: number}> => {
  assertUserId(userId, 'checkpoint');
  let result = {id: '', gap: 0};
  await database.write(async () => {
    if (!(await isUsersAccount(userId, input.accountId))) {
      throw new CheckpointRuleError('notTheUsersAccount');
    }
    const {type, gap} = await previewIn(userId, input.accountId, input.balance, input.date);
    const fields = {...input, gap, kind: checkpointKindFor(type)};
    await assertCheckpointFields(userId, fields);
    const checkpoint = await database.get<Checkpoint>('checkpoints').create(c => {
      c.userId = userId;
      c.accountId = fields.accountId;
      c.balance = fields.balance;
      c.date = fields.date;
      c.gap = fields.gap;
      c.kind = fields.kind;
      c.note = fields.note;
    });
    result = {id: checkpoint.id, gap};
  });
  return result;
};
