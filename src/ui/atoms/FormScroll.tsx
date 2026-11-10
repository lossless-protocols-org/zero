import React, {useCallback, useEffect, useRef, useState, type ReactNode} from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {gs} from '../globalStyles';

interface FormScrollProps {
  children: ReactNode;
  /** Style of the content (e.g. justify the button to the bottom). */
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * Room kept under the focused field: the calculator keys (48 + 5). A landscape
 * keyboard leaves about 110 dp, so the result line under the keys may need a
 * small scroll; the field and its keys never do.
 */
const BELOW_FOCUSED = 56;

/**
 * The body of a form screen (2.8). In portrait it is exactly the screen's
 * height, so the layout is what it always was (a list that fills the space,
 * a button at the bottom). In landscape (a phone is about 380 dp tall) it
 * grows with its content and scrolls, so the date, the categories and the
 * Add button are reachable.
 *
 * Android draws edge to edge: the keyboard covers the window instead of
 * resizing it. While it is up, the content gets that much room at the end and
 * the focused field is scrolled above it, with room for the calculator keys
 * under it (amount fields switch off Android's full-screen landscape keyboard
 * when the calculator is on, so the keys stay reachable). iOS adjusts its own
 * insets.
 *
 * Same element tree in both orientations: rotating never remounts the form,
 * so a half-typed sum survives.
 */
export const FormScroll: React.FC<FormScrollProps> = ({children, contentStyle}) => {
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const contentRef = useRef<React.ComponentRef<typeof View>>(null);
  const offset = useRef(0);
  const [viewport, setViewport] = useState(0);
  const [keyboard, setKeyboard] = useState(0);
  const {width, height} = useWindowDimensions();
  const landscape = width > height;

  const onLayout = useCallback((e: LayoutChangeEvent) => setViewport(e.nativeEvent.layout.height), []);
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = e.nativeEvent.contentOffset.y;
  }, []);

  /** Scrolls the focused field (and what sits under it) into the part the keyboard leaves. */
  const revealFocused = useCallback(
    (keyboardHeight: number) => {
      const focused = TextInput.State.currentlyFocusedInput();
      const content = contentRef.current;
      if (!focused || !content || viewport === 0) {
        return;
      }
      focused.measureLayout(
        content,
        (_x, y, _w, h) => {
          const visible = viewport - keyboardHeight;
          const bottom = y + h + BELOW_FOCUSED;
          if (bottom > offset.current + visible) {
            scrollRef.current?.scrollTo({y: Math.max(0, bottom - visible), animated: true});
          } else if (y < offset.current) {
            scrollRef.current?.scrollTo({y: Math.max(0, y - 8), animated: true});
          }
        },
        () => undefined,
      );
    },
    [viewport],
  );

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return undefined;
    }
    const show = Keyboard.addListener('keyboardDidShow', e => {
      const h = e.endCoordinates.height;
      setKeyboard(h);
      // After the padding has been laid out, so the scroll has room to move.
      requestAnimationFrame(() => revealFocused(h));
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [revealFocused]);

  // A rotation with the keyboard up: the keyboard can report its new height
  // before the form has its new size, so the field was revealed against the
  // old one, and in portrait it sat above the top of the screen with only
  // its keys showing (found on the Moto, 2026-11-09). Reveal it again once
  // the new size is laid out.
  const keyboardRef = useRef(keyboard);
  keyboardRef.current = keyboard;
  useEffect(() => {
    if (Platform.OS !== 'android' || keyboardRef.current === 0) {
      return undefined;
    }
    const frame = requestAnimationFrame(() => revealFocused(keyboardRef.current));
    return () => cancelAnimationFrame(frame);
  }, [viewport, landscape, revealFocused]);

  // Before the first layout the height is unknown: fill the screen as before.
  const sized = viewport === 0 ? gs.flex1 : landscape ? {minHeight: viewport} : {height: viewport};

  return (
    <ScrollView
      ref={scrollRef}
      style={gs.flex1}
      onLayout={onLayout}
      onScroll={onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={[styles.grow, {paddingBottom: keyboard}]}
      scrollEnabled={landscape || keyboard > 0}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      showsVerticalScrollIndicator={false}>
      <View ref={contentRef} style={[sized, contentStyle]}>
        {children}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({grow: {flexGrow: 1}});
