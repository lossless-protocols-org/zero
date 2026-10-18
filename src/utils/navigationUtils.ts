import {NavigationContainerRef, CommonActions} from '@react-navigation/native';
import type {HomeStackParamList, OnboardingStackParamList} from '../navigation/types';

type AllScreens = HomeStackParamList & OnboardingStackParamList;

let navigationRef: NavigationContainerRef<HomeStackParamList> | null = null;

export const setNavigationRef = (ref: NavigationContainerRef<HomeStackParamList>) => {
  navigationRef = ref;
};

export const navigate = <T extends keyof AllScreens>(
  name: T,
  ...args: AllScreens[T] extends undefined ? [] : [AllScreens[T]]
) => {
  if (navigationRef) {
    navigationRef.dispatch(CommonActions.navigate({name: name as string, params: args[0]}));
  } else if (__DEV__) {
    console.error(
      'Navigation reference is not set. Make sure to call setNavigationRef.',
    );
  }
};

/**
 * Goes back. Returns whether the navigation was dispatched.
 *
 * Deliberately takes NO arguments. Six screens pass this straight to
 * `onPress={goBack}`, which means React Native calls it with the press event
 * as its first argument. v2.6.6 accepted an optional `action` callback and
 * invoked it with `action?.()` — so the event object was called as a function
 * and every tap on those back arrows was a fatal `TypeError: Object is not a
 * function` (Play Console cluster of 706 users / 2.6k events, 30 Aug–18 Oct
 * 2026). TypeScript cannot catch that: `(action?: () => void) => boolean` is
 * assignable to `() => void`. No caller ever passed a callback; the parameter
 * is gone so the mistake cannot be made again. If a post-navigation side
 * effect is ever needed, call it after `goBack()` at the call site.
 */
export const goBack = (): boolean => {
  if (!navigationRef) {
    if (__DEV__) {
      console.error(
        'Navigation reference is not set. Make sure to call setNavigationRef.',
      );
    }
    return false;
  }

  navigationRef.dispatch(CommonActions.goBack());
  return true;
};
