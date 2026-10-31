import {z} from 'zod';
import {normalizeDebtType} from '../../utils/debtType';

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
/** Local ISO date (real month and day), with or without a time part. */
const isoDate = field.regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])/, {error: 'must be a YYYY-MM-DD date'});
/** Budget month key: 'YYYY-MM', 'recurring:YYYY-MM', or the legacy 'recurring'. */
const budgetMonth = field.regex(/^\d{4}-(0[1-9]|1[0-2])$|^recurring(:\d{4}-(0[1-9]|1[0-2]))?$/, {
  error: 'must be YYYY-MM or recurring:YYYY-MM',
});

const userSchema = z.object({
  username: field,
  email: field,
});

const categorySchema = z.object({
  name: field,
  categoryStatus: z.boolean().optional(),
  icon: field.optional(),
  color: field.optional(),
});

const expenseSchema = z.object({
  title: field,
  amount,
  description: field.optional(),
  category: z.object({name: field}),
  date: isoDate,
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
});

const exportEnvelopeSchema = z.object({
  key: z.string(),
  version: z.number().optional(),
  data: exportDataSchema,
});

export type ExportData = z.infer<typeof exportDataSchema>;
export type ExportEnvelope = z.infer<typeof exportEnvelopeSchema>;

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
