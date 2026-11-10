import {useCallback, useEffect, useMemo, useRef} from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Keyboard,
  Platform,
  type KeyboardEvent,
  type LayoutChangeEvent,
} from 'react-native';
import {quickAddKeyboardHeight} from '../../../platform/widgetPreferences';
import type {QuickAddHost} from './host';

/** Material 3 motion: emphasized decelerate in, emphasized accelerate out, standard for moves. */
const ENTER = {duration: 260, easing: Easing.bezier(0.05, 0.7, 0.1, 1)};
const EXIT = {duration: 180, easing: Easing.bezier(0.3, 0, 0.8, 0.15)};
const FOLLOW = {duration: 220, easing: Easing.bezier(0.2, 0, 0, 1)};
/** How far the card travels while it fades (dp): a short rise, not a full slide. */
const RISE = 56;
/** No keyboard by then (a hardware keyboard, focus refused): drop the space kept for it. */
const KEYBOARD_GRACE_MS = 700;
/**
 * iOS announces the keyboard before it moves, with its own duration: the card
 * moves with it. Android only reports once the keyboard has arrived.
 */
const SHOW = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
const HIDE = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

/**
 * How the quick-add sheet moves (2.8). Everything runs on the native driver
 * as a transform; the card is laid out once, at the bottom, and never re-laid
 * out while it moves, so nothing jumps:
 * - it rises and fades in the moment it mounts, while the window's dim fades up;
 * - it is lifted by the keyboard's overlap, starting from the overlap measured
 *   last time, so after the first open it is already where the keyboard will
 *   be and the keyboard slides in under it; later changes are eased;
 * - Save, Close, a tap outside and Back all leave the same way: the card
 *   falls and fades while the window's dim fades with it, then the window
 *   closes with no animation of its own (nothing visible is left).
 *
 * `reserve` is the card's own bottom padding beyond its usual gap (the
 * gesture bar's room), which the keyboard covers anyway. `host` says how the
 * sheet leaves (QuickAddHost).
 */
export const useSheetMotion = (reserve: number, host: QuickAddHost) => {
  const progress = useRef(new Animated.Value(0)).current;
  const liftFor = useCallback((overlap: number) => Math.max(0, overlap - reserve), [reserve]);
  const lift = useRef(new Animated.Value(liftFor(quickAddKeyboardHeight.get()))).current;
  const leaving = useRef(false);
  // The keyboard's top edge in the sheet's own window. Its reported height
  // leaves out the navigation bar under it (edge-to-edge), so the overlap is
  // measured against the window, as KeyboardAvoidingView does.
  const windowHeight = useRef(0);
  const lastEvent = useRef<KeyboardEvent | null>(null);

  const follow = useCallback(
    (overlap: number, duration: number = FOLLOW.duration) =>
      Animated.timing(lift, {toValue: liftFor(overlap), ...FOLLOW, duration, useNativeDriver: true}).start(),
    [lift, liftFor],
  );

  const applyKeyboard = useCallback(
    (event: KeyboardEvent) => {
      const overlap =
        windowHeight.current > 0
          ? Math.max(0, Math.round(windowHeight.current - event.endCoordinates.screenY))
          : Math.round(event.endCoordinates.height);
      quickAddKeyboardHeight.set(overlap);
      follow(overlap, event.duration > 0 ? event.duration : FOLLOW.duration);
    },
    [follow],
  );

  /** On the sheet's full-window root: its height is the window's. */
  const onRootLayout = useCallback(
    (event: LayoutChangeEvent) => {
      windowHeight.current = event.nativeEvent.layout.height;
      if (lastEvent.current) {
        applyKeyboard(lastEvent.current);
      }
    },
    [applyKeyboard],
  );

  useEffect(() => {
    Animated.timing(progress, {toValue: 1, ...ENTER, useNativeDriver: true}).start();
  }, [progress]);

  useEffect(() => {
    let seen = false;
    const grace = setTimeout(() => {
      if (!seen) {
        follow(0);
      }
    }, KEYBOARD_GRACE_MS);
    const shown = Keyboard.addListener(SHOW, event => {
      seen = true;
      lastEvent.current = event;
      applyKeyboard(event);
    });
    const hidden = Keyboard.addListener(HIDE, event => {
      lastEvent.current = null;
      if (!leaving.current) {
        follow(0, event.duration > 0 ? event.duration : FOLLOW.duration);
      }
    });
    return () => {
      clearTimeout(grace);
      shown.remove();
      hidden.remove();
    };
  }, [applyKeyboard, follow]);

  /** Animates the card and the dim away, then runs `then` (by default: close the sheet). */
  const leave = useCallback(
    (then: () => void = host.close) => {
      if (leaving.current) {
        return;
      }
      leaving.current = true;
      Keyboard.dismiss();
      host.dimLeaving(EXIT.duration);
      Animated.timing(progress, {toValue: 0, ...EXIT, useNativeDriver: true}).start(() => then());
    },
    [progress, host],
  );

  // Back (once the keyboard, which takes the first Back itself, is down) leaves the same way.
  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      leave();
      return true;
    });
    return () => back.remove();
  }, [leave]);

  const cardMotion = useMemo(
    () => ({
      opacity: progress,
      transform: [
        {
          translateY: Animated.subtract(progress.interpolate({inputRange: [0, 1], outputRange: [RISE, 0]}), lift),
        },
      ],
    }),
    [progress, lift],
  );

  /** The sheet's own scrim, where it draws one: in and out with the card. */
  const scrimMotion = useMemo(() => ({opacity: progress}), [progress]);

  return {cardMotion, scrimMotion, leave, onRootLayout};
};
