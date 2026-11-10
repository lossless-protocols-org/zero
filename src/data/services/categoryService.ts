import {Q} from '@nozbe/watermelondb';
import {nanoid} from 'nanoid';
import {database} from '../database/database';
import {Category} from '../database/models/Category';
import {sanitizeString, DEFAULTS} from '../../domain/sanitize';
import {assertUserId} from './assertUserId';
import type {CategoryData, CategoryKind} from '../../domain/types';
import {FREE_INCOME_CATEGORIES} from '../../domain/freeTier';
import {getExpenseRowsSince} from './expenseService';
import {CATEGORY_SORT_STEP, sortOrderAt} from '../../domain/categoryOrder';
import {toCategoryKind} from './categoryKind';
import {
  DEFAULT_INCOME_CATEGORY_COLOR,
  DEFAULT_INCOME_CATEGORY_ICON,
  DEFAULT_INCOME_CATEGORY_NAME,
  defaultIncomeCategoryId,
} from '../database/defaultIncomeCategory';
export type {CategoryData};

const toCategoryData = (c: Category): CategoryData => ({
  id: c.id,
  name: c.name,
  kind: toCategoryKind(c.kind),
  categoryStatus: c.categoryStatus,
  userId: c.userId,
  icon: sanitizeString(c.icon, DEFAULTS.icon),
  color: sanitizeString(c.color, DEFAULTS.color),
  sortOrder: c.sortOrder,
});

/** The next sort_order for a new category of this kind: after every existing one. */
const nextSortOrder = async (userId: string, kind: CategoryKind): Promise<number> => {
  const [last] = await database
    .get<Category>('categories')
    .query(Q.where('user_id', userId), Q.where('kind', kind), Q.sortBy('sort_order', Q.desc), Q.take(1))
    .fetch();
  return (last?.sortOrder ?? 0) + CATEGORY_SORT_STEP;
};

/** Two names are the same category name when they match ignoring case and outer spaces (the form's rule). */
const sameName = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Throws `duplicateName` when another ACTIVE category of the user and kind
 * already has this name. Backups and the Reports donut key categories by name,
 * so two active "Fuel"s would merge there (B2); the form refuses it first,
 * this makes it a rule (audit 2026-11-08 §4.3). Archived ones are not in the
 * way: the user cannot see them. Must run inside a writer.
 */
const assertNameFree = async (userId: string, kind: CategoryKind, name: string, exceptId?: string): Promise<void> => {
  const active = await database
    .get<Category>('categories')
    .query(Q.where('user_id', userId), Q.where('kind', kind), Q.where('category_status', true))
    .fetch();
  if (active.some(c => c.id !== exceptId && sameName(c.name, name))) {
    throw new CategoryRuleError('duplicateName');
  }
};

/**
 * Creates a new category. Refuses a name an active category of the same kind
 * already has, and a second income category on Free (CategoryRuleError).
 */
export const createCategory = async (
  name: string,
  userId: string,
  icon: string | null,
  color: string | null,
  kind: CategoryKind,
): Promise<string> => {
  assertUserId(userId, 'category');
  const id = nanoid(24);
  await database.write(async () => {
    // Free has one income category (domain/freeTier): checked in the same writer as the create.
    if (kind === 'income') {
      const incomeCount = await database
        .get<Category>('categories')
        .query(Q.where('user_id', userId), Q.where('kind', 'income'))
        .fetchCount();
      if (incomeCount >= FREE_INCOME_CATEGORIES) {
        throw new CategoryRuleError('incomeCategoryLimit');
      }
    }
    await assertNameFree(userId, kind, name);
    const sortOrder = await nextSortOrder(userId, kind);
    await database.get<Category>('categories').create(cat => {
      cat._raw.id = id;
      cat.name = name;
      cat.kind = kind;
      cat.sortOrder = sortOrder;
      cat.categoryStatus = true;
      cat.userId = userId;
      // Always assign string values for consistent Hidden Class shape
      cat.icon = sanitizeString(icon, DEFAULTS.icon);
      cat.color = sanitizeString(color, DEFAULTS.color);
    });
  });
  return id;
};

/** The rule a category write broke. */
type CategoryRule = 'lastIncomeCategory' | 'incomeCategoryLimit' | 'duplicateName';

export class CategoryRuleError extends Error {
  readonly rule: CategoryRule;
  constructor(rule: CategoryRule) {
    super(`Category rule broken: ${rule}`);
    this.name = 'CategoryRuleError';
    this.rule = rule;
  }
}

/**
 * Soft deletes a category by ID (sets categoryStatus to false). The last
 * active income category cannot go: money in always needs somewhere to land.
 */
export const softDeleteCategoryById = async (categoryId: string): Promise<void> => {
  await database.write(async () => {
    const category = await database.get<Category>('categories').find(categoryId);
    if (toCategoryKind(category.kind) === 'income') {
      const activeIncome = await database
        .get<Category>('categories')
        .query(Q.where('user_id', category.userId), Q.where('kind', 'income'), Q.where('category_status', true))
        .fetchCount();
      if (activeIncome <= 1) {
        throw new CategoryRuleError('lastIncomeCategory');
      }
    }
    await category.update(cat => {
      cat.categoryStatus = false;
    });
  });
};

/**
 * The user's default income category as a prepared create, for a caller's
 * own batch (createUser). Must run inside a writer.
 */
export const prepareDefaultIncomeCategory = (userId: string): Category =>
  database.get<Category>('categories').prepareCreate(cat => {
    cat._raw.id = defaultIncomeCategoryId(userId);
    cat.name = DEFAULT_INCOME_CATEGORY_NAME;
    cat.kind = 'income';
    cat.sortOrder = CATEGORY_SORT_STEP;
    cat.categoryStatus = true;
    cat.userId = userId;
    cat.icon = DEFAULT_INCOME_CATEGORY_ICON;
    cat.color = DEFAULT_INCOME_CATEGORY_COLOR;
  });

/**
 * Repairs the one invariant money in rests on: the user has an ACTIVE income
 * category. Every user gets one where users come from (createUser, the v5
 * upgrade, a restore), so this finds nothing to do; it runs once per session
 * (store/bootstrapSession) as the safety net, and returns true when it HAD to
 * repair, which means some path broke the invariant (the caller logs it).
 *
 * When every income category is archived (a backup from a build before the
 * planner reactivated it), the first is made active again; when there is
 * none, the default is created. Check and write are one writer, so two calls
 * cannot both seed (audit 2026-11-08 §3.4, §3.5, §4.1).
 */
export const ensureIncomeCategory = async (userId: string): Promise<boolean> => {
  assertUserId(userId, 'category');
  let repaired = false;
  await database.write(async () => {
    const existing = await database
      .get<Category>('categories')
      .query(Q.where('user_id', userId), Q.where('kind', 'income'), Q.sortBy('sort_order', Q.asc))
      .fetch();
    const [first] = existing;
    if (first && existing.some(category => category.categoryStatus !== false)) {
      return;
    }
    repaired = true;
    if (first) {
      await first.update(category => {
        category.categoryStatus = true;
      });
      return;
    }
    await database.batch(prepareDefaultIncomeCategory(userId));
  });
  return repaired;
};

/**
 * Stores a new order for one kind's categories: `orderedIds` top to bottom,
 * every id of that kind for the user. One batch.
 */
export const reorderCategories = async (
  userId: string,
  kind: CategoryKind,
  orderedIds: readonly string[],
): Promise<void> => {
  await database.write(async () => {
    const categories = await database
      .get<Category>('categories')
      .query(Q.where('user_id', userId), Q.where('kind', kind))
      .fetch();
    const byId = new Map(categories.map(c => [c.id, c]));
    if (orderedIds.length !== categories.length || orderedIds.some(id => !byId.has(id))) {
      throw new Error('reorderCategories: the order must list every category of the kind exactly once');
    }
    const updates = orderedIds.flatMap((id, index) => {
      const category = byId.get(id);
      const sortOrder = sortOrderAt(index);
      return category && category.sortOrder !== sortOrder
        ? [
            category.prepareUpdate(c => {
              c.sortOrder = sortOrder;
            }),
          ]
        : [];
    });
    await database.batch(updates);
  });
};

/**
 * Updates a category by ID
 */
export const updateCategoryById = async (
  categoryId: string,
  newName?: string,
  newIcon?: string,
  newColor?: string,
): Promise<void> => {
  await database.write(async () => {
    const category = await database.get<Category>('categories').find(categoryId);
    if (newName !== undefined && category.categoryStatus !== false) {
      await assertNameFree(category.userId, toCategoryKind(category.kind), newName, category.id);
    }
    await category.update(cat => {
      if (newName !== undefined) {
        cat.name = newName;
      }
      if (newIcon !== undefined) {
        cat.icon = sanitizeString(newIcon, DEFAULTS.icon);
      }
      if (newColor !== undefined) {
        cat.color = sanitizeString(newColor, DEFAULTS.color);
      }
    });
  });
};

/**
 * The user's categories of one kind (active and archived), in the order the
 * user sees them. Every category read names a kind (R5): expense categories
 * and income categories never mix in a list.
 */
export const getAllCategoriesByUserId = async (userId: string, kind: CategoryKind): Promise<CategoryData[]> => {
  const categories = await database
    .get<Category>('categories')
    .query(Q.where('user_id', userId), Q.where('kind', kind), Q.sortBy('sort_order', Q.asc))
    .fetch();
  return categories.map(toCategoryData);
};

/** One category (active or not), or null when the id no longer exists (M19). */
export const getCategoryById = async (categoryId: string): Promise<CategoryData | null> => {
  const [category] = await database.get<Category>('categories').query(Q.where('id', categoryId)).fetch();
  return category ? toCategoryData(category) : null;
};

/** How far back "most used" looks for the quick-add chips (2.8). */
const QUICK_WINDOW_DAYS = 90;

/** The first day ('YYYY-MM-DD', local) of the quick-category window ending at `now`. */
export const quickWindowStart = (now: Date): string => {
  const since = new Date(now.getTime() - QUICK_WINDOW_DAYS * 86_400_000);
  return `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, '0')}-${String(since.getDate()).padStart(2, '0')}`;
};

/**
 * Active categories, most used first (`usedCategoryIds`: one id per expense in
 * the window), then the user's own order. Pure; shared by the quick-add sheet
 * and the widget snapshot, which reads the rows itself.
 */
export const rankQuickCategories = (
  categories: readonly CategoryData[],
  usedCategoryIds: Iterable<string>,
): CategoryData[] => {
  const uses = new Map<string, number>();
  for (const id of usedCategoryIds) {
    uses.set(id, (uses.get(id) ?? 0) + 1);
  }
  // A stable sort keeps the user's own order among equally used categories.
  return categories
    .filter(c => c.categoryStatus !== false)
    .sort((a, b) => (uses.get(b.id) ?? 0) - (uses.get(a.id) ?? 0));
};

/**
 * The expense categories to offer first for a quick add (widget chips, the
 * quick-add sheet, launcher shortcuts): active ones, most used in the last
 * 90 days first, then the user's own order. `now` is injectable for tests.
 */
export const getQuickCategories = async (userId: string, now: Date = new Date()): Promise<CategoryData[]> => {
  const [categories, rows] = await Promise.all([
    getAllCategoriesByUserId(userId, 'expense'),
    getExpenseRowsSince(userId, quickWindowStart(now)),
  ]);
  return rankQuickCategories(
    categories,
    rows.map(row => row.categoryId),
  );
};

/** Emits after every write to categories (a rename or a new one changes the chips). */
export const observeCategoryChanges = () => database.withChangesForTables(['categories']);
