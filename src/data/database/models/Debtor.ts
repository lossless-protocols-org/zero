import {Model, Query, Relation} from '@nozbe/watermelondb';
import {field, text, children, immutableRelation, date, readonly} from '@nozbe/watermelondb/decorators';
import type {Debt} from './Debt';
import type {User} from './User';

export class Debtor extends Model {
  static table = 'debtors';

  static associations = {
    debts: {type: 'has_many' as const, foreignKey: 'debtor_id'},
    users: {type: 'belongs_to' as const, key: 'user_id'},
  };

  @text('title') title!: string;
  @text('type') type!: string;
  @field('debtor_status') debtorStatus!: boolean;
  @text('user_id') userId!: string;
  @text('icon') icon?: string;
  @text('color') color!: string;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @children('debts') debts!: Query<Debt>;
  @immutableRelation('users', 'user_id') user!: Relation<User>;
}
