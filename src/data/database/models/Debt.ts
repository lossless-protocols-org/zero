import {Model, Relation} from '@nozbe/watermelondb';
import {field, text, immutableRelation, date, readonly} from '@nozbe/watermelondb/decorators';
import type {Debtor} from './Debtor';
import type {User} from './User';

export class Debt extends Model {
  static table = 'debts';

  static associations = {
    debtors: {type: 'belongs_to' as const, key: 'debtor_id'},
    users: {type: 'belongs_to' as const, key: 'user_id'},
  };

  @text('description') description!: string;
  @field('amount') amount!: number;
  @text('debtor_id') debtorId!: string;
  @text('user_id') userId!: string;
  @text('date') date!: string;
  @text('type') type!: string;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @immutableRelation('debtors', 'debtor_id') debtor!: Relation<Debtor>;
  @immutableRelation('users', 'user_id') user!: Relation<User>;
}
