import {
  Keyboard,
  Platform,
  StatusBar,
  TouchableWithoutFeedback,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import React, {ReactNode, memo} from 'react';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme, ThemeColors} from '../../context/ThemeContext';
import {gs} from '../../styles/globalStyles';

interface PrimaryViewProps {
  colors?: ThemeColors;
  children?: ReactNode;
  style?: ViewStyle;
  /**
   * Wraps the whole screen in a TouchableWithoutFeedback so a tap anywhere
   * dismisses the keyboard.
   *
   * ⚠️ Do NOT set this on a screen whose content scrolls. The wrapper is an
   * ANCESTOR of the ScrollView, and RN grants the touch responder on
   * `onStartShouldSetResponder` — which ScrollView declines (it only takes over
   * on move) but TouchableWithoutFeedback accepts. A descendant cannot then
   * steal the responder back from its ancestor, so a drag that starts on empty
   * space never scrolls. Dragging over a row appears to work only because
   * TouchableOpacity releases the responder on move.
   *
   * For scrolling screens use the ScrollView's own
   * `keyboardShouldPersistTaps="handled"` + `keyboardDismissMode="on-drag"`,
   * which dismiss the keyboard without touching the responder chain.
   */
  dismissKeyboardOnTouch?: boolean;
  useBottomPadding?: boolean;
  useSidePadding?: boolean;
}

const PrimaryView: React.FC<PrimaryViewProps> = ({
  colors: propColors,
  children,
  style,
  dismissKeyboardOnTouch = false,
  useBottomPadding = true,
  useSidePadding = true,
}) => {
  const insets = useSafeAreaInsets();
  const {colors: contextColors, isDark} = useTheme();

  const colors = propColors || contextColors;

  const bottomPadding = useBottomPadding ? (Platform.OS === 'ios' ? insets.bottom : insets.bottom + 10) : 0;
  // Edge-to-edge means the landscape navigation bar sits over our content on
  // one side. Pad at least the inset there; the usual 4% gutter wins otherwise.
  const {width} = useWindowDimensions();
  const gutter = useSidePadding ? Math.round(width * 0.04) : 0;
  const paddingLeft = Math.max(gutter, insets.left);
  const paddingRight = Math.max(gutter, insets.right);

  const content = (
    <View
      style={[
        gs.hFull,
        {
          backgroundColor: colors.primaryBackground,
          paddingTop: insets.top,
          paddingBottom: bottomPadding,
          paddingLeft,
          paddingRight,
        },
        style,
      ]}>
      {/* No backgroundColor: the app draws edge-to-edge (Android 15+ / RN 0.88), so the
          status bar is translucent over our own background and RN 0.88 dropped the prop. */}
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      {children}
    </View>
  );

  if (dismissKeyboardOnTouch) {
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        {content}
      </TouchableWithoutFeedback>
    );
  }

  return content;
};

export default memo(PrimaryView);
