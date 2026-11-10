import {useSyncExternalStore} from 'react';
import type {MmkvPreference} from '../../platform/mmkvPreference';

/** The preference's value; re-renders whenever its `set` runs. */
export const usePreference = <T>(preference: MmkvPreference<T>): T =>
  useSyncExternalStore(preference.subscribe, preference.get, preference.get);
