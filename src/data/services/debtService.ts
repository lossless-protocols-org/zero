import {Q} from '@nozbe/watermelondb';
import {database} from '../database/database';
import {Debt} from '../database/models/Debt';
import {assertUserId} from './assertUserId';
import {normalizeDebtType} from '../../domain/debtType';
import type {DebtData, DebtType} from '../../domain/types';
export type {DebtData};

const toDebtData = (d: Debt): DebtData => ({
  id: d.id,
  description: d.description,
  amount: d.amount,
  debtorId: d.debtorId,
  userId: d.userId,
  date: d.date,
  type: normalizeDebtType(d.type),
});

/** One debt, or null when the id no longer exists (M19). */
export const getDebtById = async (debtId: string): Promise<DebtData | null> => {
  const [debt] = await database.get<Debt>('debts').query(Q.where('id', debtId)).fetch();
  return debt ? toDebtData(debt) : null;
};

/**
 * Creates a new debt
 */
export const createDebt = async (
  userId: string,
  amount: number,
  description: string,
  debtorId: string,
  date: string,
  type: DebtType,
): Promise<string> => {
  assertUserId(userId, 'debt');
  let debtId = '';
  await database.write(async () => {
    // Uses WatermelonDB auto-generated ID (library default). This is intentional;
    // other services use nanoid(24) for historical reasons. Both are valid.
    const debt = await database.get<Debt>('debts').create(d => {
      d.description = description;
      d.amount = amount;
      d.debtorId = debtorId;
      d.userId = userId;
      d.date = date;
      d.type = type;
    });
    debtId = debt.id;
  });
  return debtId;
};

/**
 * Updates a debt by ID
 */
export const updateDebtById = async (
  debtId: string,
  newAmount?: number,
  newDescription?: string,
  newDate?: string,
  newType?: DebtType,
): Promise<void> => {
  await database.write(async () => {
    const debt = await database.get<Debt>('debts').find(debtId);
    await debt.update(d => {
      if (newDescription !== undefined) {
        d.description = newDescription;
      }
      if (newAmount !== undefined) {
        d.amount = newAmount;
      }
      if (newDate !== undefined) {
        d.date = newDate;
      }
      if (newType !== undefined) {
        d.type = newType;
      }
    });
  });
};

/**
 * Deletes a debt by ID
 */
export const deleteDebtById = async (debtId: string): Promise<void> => {
  await database.write(async () => {
    const debt = await database.get<Debt>('debts').find(debtId);
    await debt.destroyPermanently();
  });
};

/**
 * Gets all debts by user ID
 */
export const getAllDebtsByUserId = async (userId: string): Promise<DebtData[]> => {
  const debts = await database.get<Debt>('debts').query(Q.where('user_id', userId)).fetch();
  return debts.map(toDebtData);
};

/**
 * Gets all debts by user ID and debtor ID
 */
export const getAllDebtsByUserIdAndDebtorId = async (userId: string, debtorId: string): Promise<DebtData[]> => {
  const debts = await database
    .get<Debt>('debts')
    .query(Q.where('user_id', userId), Q.where('debtor_id', debtorId))
    .fetch();
  return debts.map(toDebtData);
};
