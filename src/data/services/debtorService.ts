import {Q} from '@nozbe/watermelondb';
import {nanoid} from 'nanoid';
import {database} from '../database/database';
import {Debtor} from '../database/models/Debtor';
import {Debt} from '../database/models/Debt';
import {sanitizeString, DEFAULTS} from '../../domain/sanitize';
import {assertUserId} from './assertUserId';
import {isRecordNotFound} from './recordNotFound';
import type {DebtorData} from '../../domain/types';
export type {DebtorData};

/**
 * Creates a new debtor
 */
export const createDebtor = async (
  title: string,
  userId: string,
  icon: string | null,
  type: string,
  color: string | null,
): Promise<string> => {
  assertUserId(userId, 'debtor');
  const id = nanoid(24);
  await database.write(async () => {
    await database.get<Debtor>('debtors').create(debtor => {
      debtor._raw.id = id;
      debtor.title = title;
      debtor.type = type;
      debtor.debtorStatus = true;
      debtor.userId = userId;
      // Always assign string values for consistent Hidden Class shape
      debtor.icon = sanitizeString(icon, DEFAULTS.icon);
      debtor.color = sanitizeString(color, DEFAULTS.color);
    });
  });
  return id;
};

/**
 * Permanently deletes a debtor by ID
 */
export const deleteDebtorById = async (debtorId: string): Promise<void> => {
  await database.write(async () => {
    const debtor = await database.get<Debtor>('debtors').find(debtorId);
    const debts = await database.get<Debt>('debts').query(Q.where('debtor_id', debtorId)).fetch();
    await database.batch(...debts.map(debt => debt.prepareDestroyPermanently()), debtor.prepareDestroyPermanently());
  });
};

/**
 * Updates a debtor by ID
 */
export const updateDebtorById = async (
  debtorId: string,
  newTitle?: string,
  newType?: string,
  newIcon?: string,
  newColor?: string,
): Promise<void> => {
  await database.write(async () => {
    const debtor = await database.get<Debtor>('debtors').find(debtorId);
    await debtor.update(d => {
      if (newTitle !== undefined) {
        d.title = newTitle;
      }
      if (newType !== undefined) {
        d.type = newType;
      }
      if (newIcon !== undefined) {
        d.icon = sanitizeString(newIcon, DEFAULTS.icon);
      }
      if (newColor !== undefined) {
        d.color = sanitizeString(newColor, DEFAULTS.color);
      }
    });
  });
};

/**
 * Gets all debtors by user ID
 */
export const getAllDebtorsByUserId = async (userId: string): Promise<DebtorData[]> => {
  const debtors = await database.get<Debtor>('debtors').query(Q.where('user_id', userId)).fetch();
  return debtors.map(d => ({
    id: d.id,
    title: d.title,
    type: d.type,
    debtorStatus: d.debtorStatus,
    userId: d.userId,
    icon: sanitizeString(d.icon, DEFAULTS.icon),
    color: sanitizeString(d.color, DEFAULTS.color),
  }));
};

/**
 * Gets a debtor by ID
 */
export const getDebtorByDebtorId = async (debtorId: string): Promise<DebtorData | null> => {
  let debtor: Debtor;
  try {
    debtor = await database.get<Debtor>('debtors').find(debtorId);
  } catch (error) {
    // "not found" is a legitimate answer (a debtor deleted while its screen
    // was open). Anything else is a database failure and must not be read as
    // "not found" (M6, v2.7.1); the caller's thunk rejection logs it.
    // WatermelonDB 0.28 has no typed not-found error; Collection._fetchRecord
    // throws exactly this invariant text, so nothing else can match it.
    if (isRecordNotFound(error)) {
      return null;
    }
    throw error;
  }
  return {
    id: debtor.id,
    title: debtor.title,
    type: debtor.type,
    debtorStatus: debtor.debtorStatus,
    userId: debtor.userId,
    icon: sanitizeString(debtor.icon, DEFAULTS.icon),
    color: sanitizeString(debtor.color, DEFAULTS.color),
  };
};
