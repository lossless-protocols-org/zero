import {Model, type Relation} from '@nozbe/watermelondb';
import {field, text, immutableRelation, date, readonly} from '@nozbe/watermelondb/decorators';
import type {User} from './User';

/** Money moved between two of the user's accounts (schema v6). A position change, never a flow. */
export class Transfer extends Model {
  static table = 'transfers';

  static associations = {
    users: {type: 'belongs_to' as const, key: 'user_id'},
  };

  @text('user_id') userId!: string;
  @text('from_account_id') fromAccountId!: string;
  @text('to_account_id') toAccountId!: string;
  @field('amount') amount!: number;
  /** A day, 'YYYY-MM-DD'. */
  @text('date') date!: string;
  @text('note') note!: string;
  /** v6 (P9): the recurring rule this row was made from; null when entered by hand. */
  @text('recurring_id') recurringId!: string | null;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @immutableRelation('users', 'user_id') user!: Relation<User>;
}
