import {Model, type Relation} from '@nozbe/watermelondb';
import {field, text, immutableRelation, date, readonly} from '@nozbe/watermelondb/decorators';
import type {User} from './User';

/** An account's balance on a day, as the user read it from the bank or broker (schema v6). */
export class Checkpoint extends Model {
  static table = 'checkpoints';

  static associations = {
    users: {type: 'belongs_to' as const, key: 'user_id'},
  };

  @text('user_id') userId!: string;
  @text('account_id') accountId!: string;
  @field('balance') balance!: number;
  /** A day, 'YYYY-MM-DD'. */
  @text('date') date!: string;
  @field('gap') gap!: number;
  /** A CheckpointKind; read through `toCheckpointKind`. */
  @text('kind') kind!: string;
  @text('note') note!: string;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @immutableRelation('users', 'user_id') user!: Relation<User>;
}
