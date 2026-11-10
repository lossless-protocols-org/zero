import {Q} from '@nozbe/watermelondb';
import {nanoid} from 'nanoid';
import {database} from '../database/database';
import {Currency} from '../database/models/Currency';
import {assertUserId} from './assertUserId';
import {prepareAccountCurrencyUpdates} from './accountService';
import type {CurrencyData} from '../../domain/types';

/**
 * Creates a new currency
 */
export const createCurrency = async (code: string, symbol: string, name: string, userId: string): Promise<string> => {
  assertUserId(userId, 'currency');
  const id = nanoid(24);
  await database.write(async () => {
    const currency = database.get<Currency>('currencies').prepareCreate(curr => {
      curr._raw.id = id;
      curr.code = code;
      curr.symbol = symbol;
      curr.name = name;
      curr.userId = userId;
    });
    // 2.8 is single-currency: the user's accounts carry the user's code.
    await database.batch([currency, ...(await prepareAccountCurrencyUpdates(userId, code))]);
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
    const accountUpdates =
      updates.code === undefined ? [] : await prepareAccountCurrencyUpdates(currency.userId, updates.code);
    const currencyUpdate = currency.prepareUpdate(curr => {
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
    // Relabels, never converts, exactly as before; the accounts follow the label.
    await database.batch([currencyUpdate, ...accountUpdates]);
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
