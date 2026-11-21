/**
 * Test-only: a user with the default account (Cash, empty) and three more,
 * one of each kind the screens group: a bank holding 5,000, a card owing
 * 1,500, an investment worth 9,000. The store knows the user, currency and
 * categories, as the app's session does. Real LokiJS database.
 */
import {store} from '../../src/store/store';
import {resetSession} from '../../src/store/rootReducer';
import {fetchUserData} from '../../src/store/slices/userIdSlice';
import {fetchCurrency} from '../../src/store/slices/currencyDataSlice';
import {fetchCategories} from '../../src/store/slices/categoryDataSlice';
import {createAccount} from '../../src/data/services/accountService';
import {defaultAccountId} from '../../src/data/database/defaultAccount';
import * as services from './services';

export interface AccountsSeed {
  userId: string;
  cash: string;
  bank: string;
  card: string;
  fund: string;
  snacks: string;
}

export const seedAccounts = async (): Promise<AccountsSeed> => {
  await services.deleteAllData();
  store.dispatch(resetSession());
  const userId = await services.createUser('Ravi', '');
  await services.createCurrency('INR', '₹', 'Indian Rupee', userId);
  const snacks = await services.createCategory('Snacks', userId, 'utensils', '#111111', 'expense');
  const account = (name: string, type: 'bank' | 'card' | 'investment', openingBalance: number) =>
    createAccount(userId, {name, type, openingBalance, openingDate: null, icon: 'landmark', color: '#224466'});
  const bank = await account('HDFC', 'bank', 5000);
  const card = await account('Amex', 'card', -1500);
  const fund = await account('Index fund', 'investment', 9000);
  await store.dispatch(fetchUserData());
  await store.dispatch(fetchCurrency());
  await store.dispatch(fetchCategories());
  return {userId, cash: defaultAccountId(userId), bank, card, fund, snacks};
};
