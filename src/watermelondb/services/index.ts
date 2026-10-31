// User Service
export {createUser, updateUserById, getAllUsers} from './userService';

// Category Service
export {
  createCategory,
  softDeleteCategoryById,
  updateCategoryById,
  getAllCategoriesByUserId,
  getCategoryById,
} from './categoryService';
export type {CategoryData} from './categoryService';

// Expense Service
export {
  createExpense,
  updateExpenseById,
  deleteExpenseById,
  getAllExpensesByDate,
  getAllExpensesByMonth,
  getAllExpensesByCategoryAndMonth,
  getAvailableExpenseYears,
  getExpenseById,
} from './expenseService';
export type {ExpenseData, ExpenseWithCategory} from './expenseService';

// Currency Service
export {createCurrency, updateCurrencyById, getCurrencyByUserId} from './currencyService';

// Debtor Service
export {
  createDebtor,
  deleteDebtorById,
  updateDebtorById,
  getAllDebtorsByUserId,
  getDebtorByDebtorId,
} from './debtorService';
export type {DebtorData} from './debtorService';

// Debt Service
export {
  createDebt,
  updateDebtById,
  deleteDebtById,
  getAllDebtsByUserId,
  getAllDebtsByUserIdAndDebtorId,
  getDebtById,
} from './debtService';
export type {DebtData} from './debtService';

// Get Service
export {getAllData} from './getService';
export type {ExportDraft} from './getService';

// Delete Service
export {deleteAllData, countAllRecords} from './deleteService';
export type {RecordCounts} from './deleteService';

// Budget Service
export {upsertBudget, getBudgetsByMonth} from './budgetService';
export type {BudgetData} from './budgetService';

// Import Service (atomic backup restore)
export {importAllData} from './importService';
