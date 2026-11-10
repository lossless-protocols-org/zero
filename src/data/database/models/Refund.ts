import {Model, type Relation} from '@nozbe/watermelondb';
import {field, text, immutableRelation, date, readonly} from '@nozbe/watermelondb/decorators';
import type {Expense} from './Expense';
import type {User} from './User';

/** Money that came back for one expense (schema v5). Deleted with its expense. */
export class Refund extends Model {
  static table = 'refunds';

  static associations = {
    expenses: {type: 'belongs_to' as const, key: 'expense_id'},
    users: {type: 'belongs_to' as const, key: 'user_id'},
  };

  @text('user_id') userId!: string;
  @text('expense_id') expenseId!: string;
  @text('account_id') accountId!: string;
  @field('amount') amount!: number;
  @text('date') date!: string;
  @text('note') note!: string;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @immutableRelation('expenses', 'expense_id') expense!: Relation<Expense>;
  @immutableRelation('users', 'user_id') user!: Relation<User>;
}
