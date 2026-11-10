import {User, Category, Expense, Currency, Debtor, Debt, Budget, Account, Refund, Income} from '.';

/**
 * Every model the database registers, in one list shared by the app database
 * and the LokiJS test harness, so a table added to the schema cannot be
 * missing from either. modelDecorators.test.ts checks each has timestamps.
 */
export const MODEL_CLASSES = [User, Category, Expense, Currency, Debtor, Debt, Budget, Account, Refund, Income];
