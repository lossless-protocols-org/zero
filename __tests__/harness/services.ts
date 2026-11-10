/**
 * Test-only: the services the integration tests call, under one name
 * (`services.createUser(...)`), so a test reads like the flow it checks.
 * Product code imports each service from its own module; the data barrels
 * were removed (audit 2026-11-08 §5), so no product module pulls every
 * service and the database in through one import. Explicit names, no
 * `export *`: a test that needs another service adds it here.
 */
export {createUser, getAllUsers} from '../../src/data/services/userService';
export {
  createCategory,
  getAllCategoriesByUserId,
  getCategoryById,
  softDeleteCategoryById,
} from '../../src/data/services/categoryService';
export {
  createExpense,
  deleteExpenseById,
  getAllExpensesByCategoryAndMonth,
  getAllExpensesByDate,
  getAllExpensesByMonth,
  getExpenseById,
  updateExpenseById,
} from '../../src/data/services/expenseService';
export {createCurrency, getCurrencyByUserId, updateCurrencyById} from '../../src/data/services/currencyService';
export {createDebtor, getDebtorByDebtorId} from '../../src/data/services/debtorService';
export {createDebt, getDebtById} from '../../src/data/services/debtService';
export {countAllRecords, deleteAllData} from '../../src/data/services/deleteService';
export {upsertBudget} from '../../src/data/services/budgetService';
