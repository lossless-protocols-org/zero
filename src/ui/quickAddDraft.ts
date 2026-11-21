/**
 * What the quick-add sheet hands to the full Add expense form when the user
 * asks for "More details" (2.8). One slot, taken once: both are React roots on
 * the same JS runtime, so a module variable is the whole handover.
 */
export interface QuickAddDraft {
  title: string;
  amount: string;
  categoryId: string;
  /** Reconcile's "Record what's missing" (3.0): the day and the account the missing expense belongs to. */
  date?: string;
  accountId?: string;
}

/** What reconcile hands to Add money in (3.0): the amount, day and account a missing income belongs to. */
export interface IncomeDraft {
  amount: string;
  /** 'YYYY-MM-DD'. */
  date: string;
  accountId: string;
}

let incomeDraft: IncomeDraft | null = null;

export const setIncomeDraft = (next: IncomeDraft): void => {
  incomeDraft = next;
};

/** Returns the waiting income draft and clears it. */
export const takeIncomeDraft = (): IncomeDraft | null => {
  const taken = incomeDraft;
  incomeDraft = null;
  return taken;
};

let draft: QuickAddDraft | null = null;

export const setQuickAddDraft = (next: QuickAddDraft): void => {
  draft = next;
};

/** Returns the waiting draft and clears it, so a later Add starts empty. */
export const takeQuickAddDraft = (): QuickAddDraft | null => {
  const taken = draft;
  draft = null;
  return taken;
};
