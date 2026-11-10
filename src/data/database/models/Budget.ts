import {Model, type Relation} from '@nozbe/watermelondb';
import {text, field, immutableRelation, date, readonly} from '@nozbe/watermelondb/decorators';
import type {User} from './User';

export class Budget extends Model {
  static table = 'budgets';

  static associations = {
    users: {type: 'belongs_to' as const, key: 'user_id'},
  };

  @text('user_id') userId!: string;
  /**
   * The category of a per-category budget (`budgetType` 'category'); '' on the
   * overall monthly budget. Typed as string to match what is written; the
   * service maps rows to `BudgetData`, where the id exists only on category
   * budgets. `month` is a stored key: read it through `parseBudgetMonth`.
   */
  @text('category_id') categoryId!: string;
  @field('amount') amount!: number;
  @text('month') month!: string;
  @text('budget_type') budgetType!: string;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @immutableRelation('users', 'user_id') user!: Relation<User>;
}
