import {createMmkvPreference, jsonBooleanValue} from './mmkvPreference';

/**
 * Whether the user finished onboarding; MainStack picks its screens from it.
 * Losing it is safe (the data stays in SQLite and the Welcome screen offers to
 * keep it), so a corrupt value reads as false.
 */
export const isOnboardedPreference = createMmkvPreference('isOnboarded', jsonBooleanValue, false);
