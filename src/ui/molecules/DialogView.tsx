import React, {useMemo} from 'react';
import {Modal, Pressable, StyleSheet, TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {PrimaryText} from '../atoms/PrimaryText';
import {Icon} from '../atoms/Icons';
import {useThemeColors} from '../hooks/useThemeColors';
import type {DialogType, DialogViewProps} from '../context/DialogContext';
import {gs} from '../globalStyles';
import {hexToRgba} from '../colorUtils';
import type {IconName} from '../atoms/IconRegistry';

const TYPE_ICON: Record<DialogType, IconName> = {
  success: 'badge-check',
  warning: 'shield-alert',
  error: 'alert-circle',
  info: 'badge-info',
};

const TYPE_LABEL = {
  success: 'dialog.typeSuccess',
  warning: 'dialog.typeWarning',
  error: 'dialog.typeError',
  info: 'dialog.typeInfo',
} as const satisfies Record<DialogType, string>;

/** The app's alert/confirm dialog, driven by DialogProvider. */
export const DialogView: React.FC<DialogViewProps> = ({visible, dialog: display, onClose}) => {
  const colors = useThemeColors();
  const {t} = useTranslation();

  // Backdrop tap / Android back = cancel for confirmations. For alerts (no
  // cancel button) it simply closes, which is what `resolve()` already does.
  const handleDismissRequest = () => onClose(false);

  const dialogType = display?.type ?? 'info';

  // Themed scrim: a fixed black wash sat oddly over the dark theme.
  const overlayColor = useMemo(() => hexToRgba(colors.sameBlack ?? '#000000', 0.45), [colors.sameBlack]);

  const accentColor = useMemo(() => {
    switch (dialogType) {
      case 'success':
        return colors.accentGreen;
      case 'warning':
        return colors.accentOrange;
      case 'error':
        return colors.accentRed;
      default:
        return colors.accentBlue;
    }
  }, [dialogType, colors]);

  // Screen readers: say what kind of dialog this is, then the message (M28).
  // Opening the modal moves focus to the message, which reads it once; an
  // announcement or a live region as well made TalkBack say it twice.
  const spokenMessage = t('dialog.spoken', {type: t(TYPE_LABEL[dialogType]), message: display?.message ?? ''});

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      // Android hardware back previously did nothing while a dialog was up
      // (and RN warns without this). Treat it as a cancel.
      onRequestClose={handleDismissRequest}>
      {/* The scrim and the card wrapper only route taps: hidden from assistive
          tech, so it reaches the message and the buttons inside (M28). The
          backdrop tap stays; a screen reader cancels with Escape / Back. */}
      <Pressable
        style={[gs.flex1, gs.center, {backgroundColor: overlayColor}]}
        accessible={false}
        importantForAccessibility="no"
        onPress={handleDismissRequest}>
        <Pressable
          style={[gs.wFull, gs.itemsCenter]}
          accessible={false}
          importantForAccessibility="no"
          accessibilityViewIsModal
          onAccessibilityEscape={handleDismissRequest}
          onPress={event => event.stopPropagation()}>
          <View style={[gs.roundedTop24, gs.w80p, styles.accentBar, {backgroundColor: accentColor}]} />
          <View style={[gs.center, gs.py20, gs.px20, gs.w80p, styles.card, {backgroundColor: colors.secondaryAccent}]}>
            <View
              style={[gs.size40, gs.roundedFull, gs.center, gs.mb10, {backgroundColor: hexToRgba(accentColor, 0.125)}]}>
              <Icon name={TYPE_ICON[dialogType]} size={22} color={accentColor} />
            </View>
            <PrimaryText
              size={13}
              color={colors.primaryText}
              style={gs.textCenter}
              accessibilityRole="alert"
              accessibilityLabel={spokenMessage}>
              {display?.message}
            </PrimaryText>
            {display?.bullets?.length ? (
              <View style={[gs.wFull, gs.mt15, gs.gap12]}>
                {display.bullets.map(bullet => (
                  <View key={bullet.text} style={[gs.row, gs.itemsStart, gs.gap10]}>
                    <View style={[gs.size24, gs.rounded8, gs.center, {backgroundColor: hexToRgba(accentColor, 0.125)}]}>
                      <Icon name={bullet.icon} size={13} color={accentColor} />
                    </View>
                    <PrimaryText size={12} color={colors.secondaryText} style={[gs.flex1, gs.textLeft]}>
                      {bullet.text}
                    </PrimaryText>
                  </View>
                ))}
              </View>
            ) : null}
            <View style={[gs.rowCenter, gs.mt15, gs.gap12, display?.showCancel ? gs.justifyBetween : gs.justifyCenter]}>
              {display?.showCancel && (
                <TouchableOpacity
                  onPress={() => onClose(false)}
                  activeOpacity={0.7}
                  accessibilityLabel={display.cancelLabel ?? t('common.cancel')}
                  accessibilityRole="button">
                  <View style={[styles.button, gs.rounded5, gs.center, {backgroundColor: colors.accentRed}]}>
                    <PrimaryText size={13} weight="semibold" color={colors.buttonText}>
                      {display.cancelLabel ?? t('common.cancel')}
                    </PrimaryText>
                  </View>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => onClose(true)}
                activeOpacity={0.7}
                accessibilityLabel={display?.okLabel ?? t('common.ok')}
                accessibilityRole="button">
                <View style={[styles.button, gs.rounded5, gs.center, {backgroundColor: colors.accentGreen}]}>
                  <PrimaryText size={13} weight="semibold" color={colors.buttonText}>
                    {display?.okLabel ?? t('common.ok')}
                  </PrimaryText>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  accentBar: {height: 10},
  card: {borderBottomLeftRadius: 8, borderBottomRightRadius: 8},
  // At least 44 pt to touch (M30) and growing with long labels and large text,
  // where the old fixed 60×35 box clipped both.
  button: {minWidth: 60, minHeight: 44, paddingHorizontal: 12},
});
