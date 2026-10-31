/**
 * Every row carries `user_id`, and every per-user query filters on it, so a
 * row written with `user_id = ''` is invisible in the app — and if the user
 * row itself is gone, the export is unrestorable (the validator refuses
 * `users: []`). Writers call this first (M2, v2.7.1) so the failure is loud
 * where it happens, not at restore time months later. An empty id can also
 * mean the user fetch has not resolved yet; the message does not guess.
 */
export const assertUserId = (userId: string, what: string): void => {
  if (!userId) {
    throw new Error(`Cannot create ${what}: the user id is empty (user not loaded, or the user row is missing)`);
  }
};
