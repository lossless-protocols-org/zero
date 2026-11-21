import {Model, type Relation} from '@nozbe/watermelondb';
import {field, text, immutableRelation, date, readonly} from '@nozbe/watermelondb/decorators';
import type {User} from './User';

/**
 * Something that repeats (schema v6, plan P9): rent, a salary, an SIP. It
 * makes ordinary expenses, money in or transfers on the days it falls due
 * (recurringService); its own row is never totalled.
 */
export class RecurringRule extends Model {
  static table = 'recurring_rules';

  static associations = {
    users: {type: 'belongs_to' as const, key: 'user_id'},
  };

  @text('user_id') userId!: string;
  /** A RuleTarget ('expense' | 'income' | 'transfer'); read through `toRuleTarget`. */
  @text('target') target!: string;
  @text('title') title!: string;
  /** '' for a transfer. */
  @text('category_id') categoryId!: string;
  @text('account_id') accountId!: string;
  @text('to_account_id') toAccountId!: string | null;
  /** Null: varies; each occurrence asks. */
  @field('amount') amount!: number | null;
  /** A Cadence; read through `toCadence`. */
  @text('cadence') cadence!: string;
  @field('interval') interval!: number;
  @text('start_date') startDate!: string;
  @text('end_date') endDate!: string | null;
  @field('next_index') nextIndex!: number;
  @text('next_run') nextRun!: string | null;
  @field('remind_days_before') remindDaysBefore!: number | null;
  @field('rule_status') ruleStatus!: boolean;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @immutableRelation('users', 'user_id') user!: Relation<User>;
}
