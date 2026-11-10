import {z} from 'zod';
import {normalizeDebtType} from '../../../domain/debtType';

/**
 * Bounds on what a backup may contain (L7, v2.7.1). The UI can never produce
 * a negative amount or a date outside `YYYY-MM-DD…`, but a hand-edited or
 * foreign file could; such rows used to import, count towards totals and
 * never match a month query, which looks like lost data. Rejections name the
 * field. 200 characters is far above every UI cap (titles 25, descriptions
 * 50 — i18n/validationSchema.ts — and category names shorter still) while
 * refusing multi-kilobyte blobs; the amount bound is above the UI's
 * 10^(9+decimals) major-unit limit.
 */
const MAX_AMOUNT = 1e13;
const MAX_FIELD = 200;
// zod 4's z.number() already rejects NaN and ±Infinity.
const amount = z
  .number({error: 'must be a number'})
  .nonnegative({error: 'must not be negative'})
  .max(MAX_AMOUNT, {error: 'must be at most 10,000,000,000,000'});
const field = z.string({error: 'must be text'}).max(MAX_FIELD, {error: `must be at most ${MAX_FIELD} characters`});
/** Strictly more than zero: refunds and incomes (v5) never store 0 (R1). Expenses keep 2.7.1's rule. */
const positiveAmount = amount.positive({error: 'must be more than 0'});
/** Epoch milliseconds (v5 timestamps); optional everywhere, derived from the row's date when absent. */
const timestamp = z.number({error: 'must be a number'}).int().nonnegative().max(8.64e15);
/** Local ISO date (real month and day), with or without a time part. */
const isoDate = field.regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])/, {error: 'must be a YYYY-MM-DD date'});
/** Budget month key: 'YYYY-MM', 'recurring:YYYY-MM', or the legacy 'recurring'. */
const budgetMonth = field.regex(/^\d{4}-(0[1-9]|1[0-2])$|^recurring(:\d{4}-(0[1-9]|1[0-2]))?$/, {
  error: 'must be YYYY-MM or recurring:YYYY-MM',
});

/** A calendar day only, 'YYYY-MM-DD': income has no time of day. */
const isoDay = field.regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, {error: 'must be a YYYY-MM-DD day'});

const userSchema = z.object({
  username: field,
  email: field,
});

const categorySchema = z.object({
  name: field,
  categoryStatus: z.boolean().optional(),
  icon: field.optional(),
  color: field.optional(),
  // v5. Files before v5 have expense categories only.
  kind: z.enum(['expense', 'income'], {error: "must be 'expense' or 'income'"}).default('expense'),
  sortOrder: z.number({error: 'must be a number'}).int().nonnegative().optional(),
});

/** v5: an account, referenced from entries by name. Opening balance may be negative (a card). */
const accountSchema = z.object({
  name: field,
  type: field,
  currency: field,
  openingBalance: z.number({error: 'must be a number'}).min(-MAX_AMOUNT).max(MAX_AMOUNT),
  openingDate: isoDay.nullable(),
  isDefault: z.boolean(),
  accountStatus: z.boolean(),
  sortOrder: z.number({error: 'must be a number'}).int().nonnegative(),
  icon: field,
  color: field,
});

/** v5: money that came back, nested in its expense (it cannot exist without one). */
const refundSchema = z.object({
  amount: positiveAmount,
  date: isoDate,
  note: field,
  createdAt: timestamp.optional(),
  updatedAt: timestamp.optional(),
});

const expenseSchema = z.object({
  title: field,
  amount,
  description: field.optional(),
  category: z.object({name: field}),
  date: isoDate,
  // v5. `account` is omitted for the default account; refunds when there are none.
  account: field.optional(),
  createdAt: timestamp.optional(),
  updatedAt: timestamp.optional(),
  refunds: z.array(refundSchema).optional(),
});

/** v5: money that came in. `category` names a category of kind 'income'. */
const incomeSchema = z.object({
  amount: positiveAmount,
  date: isoDay,
  category: z.object({name: field}),
  note: field,
  account: field.optional(),
  createdAt: timestamp.optional(),
  updatedAt: timestamp.optional(),
});

const currencySchema = z.object({
  code: field,
  symbol: field,
  name: field,
});

const debtorSchema = z.object({
  title: field,
  debtorStatus: z.boolean().optional(),
  icon: field.optional(),
  type: field.optional(),
  color: field.optional(),
});

const debtSchema = z.object({
  amount,
  description: field,
  debtor: z.object({title: field}),
  date: isoDate,
  // Free text in older files; folded into the two types the app knows (B7, M18).
  type: field.transform(normalizeDebtType),
  createdAt: timestamp.optional(),
  updatedAt: timestamp.optional(),
});

const budgetSchema = z.object({
  amount,
  month: budgetMonth,
  budgetType: field,
  /** Present on per-category budgets (budgetType 'category'); the overall budget has none. */
  category: z.object({name: field}).optional(),
});

const exportDataSchema = z.object({
  // A tuple with a rest element, not min(1): the type then says users[0] exists (M20).
  users: z.tuple([userSchema], userSchema),
  categories: z.array(categorySchema),
  expenses: z.array(expenseSchema),
  currencies: z.array(currencySchema),
  debtors: z.array(debtorSchema),
  debts: z.array(debtSchema),
  budgets: z.array(budgetSchema).default([]),
  // v5. Older files have neither; the planner always creates the default account.
  accounts: z.array(accountSchema).default([]),
  incomes: z.array(incomeSchema).default([]),
});

const exportEnvelopeSchema = z.object({
  key: z.string(),
  version: z.number().optional(),
  data: exportDataSchema,
});

export type ExportData = z.infer<typeof exportDataSchema>;
type ExportEnvelope = z.infer<typeof exportEnvelopeSchema>;

interface ValidationResult {
  success: boolean;
  data?: ExportEnvelope;
  error?: string;
  /** Path of the first issue, e.g. ['data', 'expenses', '4711', 'amount']. */
  issuePath?: string[];
}

/**
 * Validates the structure of an import file before processing.
 * Returns a typed result to avoid exceptions during import.
 */
export const validateExportEnvelope = (json: unknown): ValidationResult => {
  const result = exportEnvelopeSchema.safeParse(json);
  if (result.success) {
    return {success: true, data: result.data};
  }

  const firstIssue = result.error.issues[0];
  const path = firstIssue?.path ?? [];
  // `users` is a tuple (M20), so an empty list reports "row 1 … expected object".
  if (path[0] === 'data' && path[1] === 'users' && path[2] === 0 && firstIssue?.code === 'invalid_type') {
    return {
      success: false,
      error: 'This backup has no user profile, so it cannot be restored.',
      issuePath: path.map(String),
    };
  }
  const message = firstIssue?.message || 'Unknown validation error';
  return {
    success: false,
    error: describeIssuePath(path, message),
    issuePath: path.map(String),
  };
};

/**
 * `data.expenses.4711.amount` → `expenses row 4712, amount: …` — the row
 * number is what a person counting in the file or the app can use.
 */
const describeIssuePath = (path: ReadonlyArray<PropertyKey>, message: string): string => {
  const [root, table, index, ...rest] = path.map(String);
  if (root === 'data' && table && index !== undefined && /^\d+$/.test(index)) {
    const column = rest.join('.');
    return `${table} row ${Number(index) + 1}${column ? `, ${column}` : ''}: ${message}`;
  }
  const joined = path.map(String).join('.');
  return joined ? `Invalid field "${joined}": ${message}` : message;
};
