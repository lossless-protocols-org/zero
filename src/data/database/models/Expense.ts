import {Model, Relation} from '@nozbe/watermelondb';
import {field, text, immutableRelation, date, readonly} from '@nozbe/watermelondb/decorators';
import type {Category} from './Category';
import type {User} from './User';

export class Expense extends Model {
  static table = 'expenses';

  static associations = {
    categories: {type: 'belongs_to' as const, key: 'category_id'},
    users: {type: 'belongs_to' as const, key: 'user_id'},
    refunds: {type: 'has_many' as const, foreignKey: 'expense_id'},
  };

  @text('title') title!: string;
  @field('amount') amount!: number;
  @text('description') description?: string;
  @text('category_id') categoryId!: string;
  @text('user_id') userId!: string;
  @text('date') date!: string;
  /** v5: the account it was paid from; the user's default account in 2.8. */
  @text('account_id') accountId!: string;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @immutableRelation('categories', 'category_id') category!: Relation<Category>;
  @immutableRelation('users', 'user_id') user!: Relation<User>;
}
