import {Model, type Relation} from '@nozbe/watermelondb';
import {field, text, immutableRelation, date, readonly} from '@nozbe/watermelondb/decorators';
import type {Category} from './Category';
import type {User} from './User';

/** Money that came in (schema v5). `date` is a day: income has no time of day. */
export class Income extends Model {
  static table = 'incomes';

  static associations = {
    categories: {type: 'belongs_to' as const, key: 'category_id'},
    users: {type: 'belongs_to' as const, key: 'user_id'},
  };

  @text('user_id') userId!: string;
  @text('category_id') categoryId!: string;
  @text('account_id') accountId!: string;
  @field('amount') amount!: number;
  @text('date') date!: string;
  @text('note') note!: string;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @immutableRelation('categories', 'category_id') category!: Relation<Category>;
  @immutableRelation('users', 'user_id') user!: Relation<User>;
}
