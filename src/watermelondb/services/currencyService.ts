import {Q} from '@nozbe/watermelondb';
import {nanoid} from 'nanoid';
import {database} from '../database';
import Currency from '../models/Currency';
import {assertUserId} from './assertUserId';
import type {CurrencyData} from '../../domain/types';

/**
 * Creates a new currency
 */
export const createCurrency = async (code: string, symbol: string, name: string, userId: string): Promise<string> => {
  assertUserId(userId, 'currency');
  const id = nanoid(24);
  await database.write(async () => {
    await database.get<Currency>('currencies').create(curr => {
      curr._raw.id = id;
      curr.code = code;
      curr.symbol = symbol;
      curr.name = name;
      curr.userId = userId;
    });
  });
  return id;
};

/**
 * Updates a currency by ID
 */
export const updateCurrencyById = async (
  currencyId: string,
  updates: {code?: string; symbol?: string; name?: string},
): Promise<void> => {
  await database.write(async () => {
    const currency = await database.get<Currency>('currencies').find(currencyId);
    await currency.update(curr => {
      if (updates.code !== undefined) {
        curr.code = updates.code;
      }
      if (updates.symbol !== undefined) {
        curr.symbol = updates.symbol;
      }
      if (updates.name !== undefined) {
        curr.name = updates.name;
      }
    });
  });
};

/**
 * Gets currency by user ID
 */
export const getCurrencyByUserId = async (userId: string): Promise<CurrencyData | null> => {
  const currencies = await database.get<Currency>('currencies').query(Q.where('user_id', userId)).fetch();

  const [currency] = currencies;
  if (!currency) {
    return null;
  }

  return {
    id: currency.id,
    code: currency.code,
    symbol: currency.symbol,
    name: currency.name,
    userId: currency.userId,
  };
};
