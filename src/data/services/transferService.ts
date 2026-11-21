import {Q} from '@nozbe/watermelondb';
import {database} from '../database/database';
import {Transfer} from '../database/models/Transfer';
import {assertUserId} from './assertUserId';
import {isUsersAccount, isUsersActiveAccount} from './accountService';
import {isCalendarDay} from '../../domain/dates';
import {MAX_AMOUNT, MAX_TEXT} from '../../domain/limits';
import {toMoneyUnits} from '../../domain/money';
import type {IsoDay} from '../../domain/types';

/**
 * Money moved between two of the user's accounts (schema v6, 3.0). A
 * position change, never a flow: no period total reads this table (R14);
 * balances read it (netWorthService).
 */

type TransferRule =
  | 'amountNotPositive'
  | 'amountTooLarge'
  | 'noteTooLong'
  | 'notADay'
  | 'notTheUsersAccount'
  | 'sameAccount'
  | 'accountArchived';

/** A write refused because it would store an invalid transfer. The UI maps `rule` to copy. */
export class TransferRuleError extends Error {
  readonly rule: TransferRule;
  constructor(rule: TransferRule) {
    super(`Transfer rule broken: ${rule}`);
    this.name = 'TransferRuleError';
    this.rule = rule;
  }
}

interface TransferFields {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  note: string;
}

/**
 * An end the transfer is being moved to must be active: an archived account
 * takes no new money. An end it already has may be archived (an old
 * transfer stays editable).
 */
const assertActiveEnds = async (userId: string, ends: Array<string | undefined>): Promise<void> => {
  for (const accountId of ends) {
    if (accountId !== undefined && !(await isUsersActiveAccount(userId, accountId))) {
      throw new TransferRuleError('accountArchived');
    }
  }
};

const assertTransferFields = async (userId: string, fields: TransferFields): Promise<void> => {
  if (!Number.isFinite(fields.amount) || toMoneyUnits(fields.amount) <= 0) {
    throw new TransferRuleError('amountNotPositive');
  }
  // The backup's own bounds (domain/limits): a row past them would stop every later export.
  if (fields.amount > MAX_AMOUNT) {
    throw new TransferRuleError('amountTooLarge');
  }
  if (fields.note.length > MAX_TEXT) {
    throw new TransferRuleError('noteTooLong');
  }
  if (!isCalendarDay(fields.date)) {
    throw new TransferRuleError('notADay');
  }
  // A transfer to the same account moves nothing and would read as two movements.
  if (fields.fromAccountId === fields.toAccountId) {
    throw new TransferRuleError('sameAccount');
  }
  // Both ends the user's own: never another user's account, never one that does not exist.
  const [from, to] = await Promise.all([
    isUsersAccount(userId, fields.fromAccountId),
    isUsersAccount(userId, fields.toAccountId),
  ]);
  if (!from || !to) {
    throw new TransferRuleError('notTheUsersAccount');
  }
};

/** Records a transfer between two of the user's active accounts. */
export const createTransfer = async (
  userId: string,
  input: {fromAccountId: string; toAccountId: string; amount: number; date: IsoDay; note: string},
): Promise<string> => {
  assertUserId(userId, 'transfer');
  let id = '';
  await database.write(async () => {
    await assertTransferFields(userId, input);
    await assertActiveEnds(userId, [input.fromAccountId, input.toAccountId]);
    const transfer = await database.get<Transfer>('transfers').create(t => {
      t.userId = userId;
      t.fromAccountId = input.fromAccountId;
      t.toAccountId = input.toAccountId;
      t.amount = input.amount;
      t.date = input.date;
      t.note = input.note;
    });
    id = transfer.id;
  });
  return id;
};

/** Changes the fields given and no other (law L6). The result must still be a valid transfer. */
export const updateTransfer = async (
  transferId: string,
  patch: {fromAccountId?: string; toAccountId?: string; amount?: number; date?: IsoDay; note?: string},
): Promise<void> => {
  await database.write(async () => {
    const transfer = await database.get<Transfer>('transfers').find(transferId);
    await assertTransferFields(transfer.userId, {
      fromAccountId: patch.fromAccountId ?? transfer.fromAccountId,
      toAccountId: patch.toAccountId ?? transfer.toAccountId,
      amount: patch.amount ?? transfer.amount,
      date: patch.date ?? transfer.date,
      note: patch.note ?? transfer.note,
    });
    await assertActiveEnds(transfer.userId, [
      patch.fromAccountId === transfer.fromAccountId ? undefined : patch.fromAccountId,
      patch.toAccountId === transfer.toAccountId ? undefined : patch.toAccountId,
    ]);
    await transfer.update(t => {
      if (patch.fromAccountId !== undefined) {
        t.fromAccountId = patch.fromAccountId;
      }
      if (patch.toAccountId !== undefined) {
        t.toAccountId = patch.toAccountId;
      }
      if (patch.amount !== undefined) {
        t.amount = patch.amount;
      }
      if (patch.date !== undefined) {
        t.date = patch.date;
      }
      if (patch.note !== undefined) {
        t.note = patch.note;
      }
    });
  });
};

/** Deletes a transfer. */
export const deleteTransfer = async (transferId: string): Promise<void> => {
  await database.write(async () => {
    const transfer = await database.get<Transfer>('transfers').find(transferId);
    await transfer.destroyPermanently();
  });
};

/** A transfer as its edit screen shows it. */
export interface TransferData {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: IsoDay;
  note: string;
}

/** One transfer, or null when it no longer exists (deleted elsewhere). */
export const getTransferById = async (transferId: string): Promise<TransferData | null> => {
  const [transfer] = await database.get<Transfer>('transfers').query(Q.where('id', transferId)).fetch();
  if (!transfer) {
    return null;
  }
  return {
    id: transfer.id,
    fromAccountId: transfer.fromAccountId,
    toAccountId: transfer.toAccountId,
    amount: transfer.amount,
    // Stored as a day: the service writes nothing else, and the backup check refuses anything else.
    date: transfer.date as IsoDay,
    note: transfer.note,
  };
};
