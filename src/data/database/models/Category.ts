import {Model, Query, Relation} from '@nozbe/watermelondb';
import {field, text, children, immutableRelation, date, readonly} from '@nozbe/watermelondb/decorators';
import type {Expense} from './Expense';
import type {User} from './User';

export class Category extends Model {
  static table = 'categories';

  static associations = {
    expenses: {type: 'has_many' as const, foreignKey: 'category_id'},
    users: {type: 'belongs_to' as const, key: 'user_id'},
  };

  @text('name') name!: string;
  @field('category_status') categoryStatus!: boolean;
  @text('user_id') userId!: string;
  @text('icon') icon?: string;
  @text('color') color!: string;
  /** v5: 'expense' | 'income'. Read through `toCategoryKind`. */
  @text('kind') kind!: string;
  @field('sort_order') sortOrder!: number;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @children('expenses') expenses!: Query<Expense>;
  @immutableRelation('users', 'user_id') user!: Relation<User>;
}
