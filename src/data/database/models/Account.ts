import {Model, type Relation} from '@nozbe/watermelondb';
import {field, text, immutableRelation, date, readonly} from '@nozbe/watermelondb/decorators';
import type {User} from './User';

/** Where money sits (schema v5). One hidden default per user in 2.8. */
export class Account extends Model {
  static table = 'accounts';

  static associations = {
    users: {type: 'belongs_to' as const, key: 'user_id'},
  };

  @text('user_id') userId!: string;
  @text('name') name!: string;
  /** An AccountType; read through `toAccountType`. */
  @text('type') type!: string;
  @text('currency') currency!: string;
  @field('opening_balance') openingBalance!: number;
  @text('opening_date') openingDate!: string | null;
  @field('is_default') isDefault!: boolean;
  @field('account_status') accountStatus!: boolean;
  @field('sort_order') sortOrder!: number;
  @text('icon') icon!: string;
  @text('color') color!: string;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @immutableRelation('users', 'user_id') user!: Relation<User>;
}
