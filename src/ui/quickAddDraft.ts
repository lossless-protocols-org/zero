/**
 * What the quick-add sheet hands to the full Add expense form when the user
 * asks for "More details" (2.8). One slot, taken once: both are React roots on
 * the same JS runtime, so a module variable is the whole handover.
 */
export interface QuickAddDraft {
  title: string;
  amount: string;
  categoryId: string;
}

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
