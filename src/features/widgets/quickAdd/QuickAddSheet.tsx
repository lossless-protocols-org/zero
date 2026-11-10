import React, {useRef} from 'react';
import {Animated, Platform, Pressable, ScrollView, StyleSheet, TextInput, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {PrimaryText} from '../../../ui/atoms/PrimaryText';
import {PrimaryButton} from '../../../ui/atoms/PrimaryButton';
import {AmountInput} from '../../../ui/atoms/AmountInput';
import {Icon} from '../../../ui/atoms/Icons';
import {CategoryContainer} from '../../../ui/molecules/CategoryContainer';
import {useThemeColors} from '../../../ui/hooks/useThemeColors';
import {gs, hitSlop} from '../../../ui/globalStyles';
import {logRejection} from '../../../platform/errorLog';
import {useQuickAdd, type QuickAddKind, type QuickAddPrefill} from './useQuickAdd';
import {useSheetMotion} from './useSheetMotion';
import type {QuickAddHost} from './host';

interface QuickAddSheetProps {
  kind: QuickAddKind;
  categoryId: string;
  /** False before onboarding: nothing can be saved yet. */
  ready: boolean;
  /** Where the sheet is shown, and so how it leaves. */
  host: QuickAddHost;
  /** Opens filled in ("add again"). */
  prefill?: QuickAddPrefill;
}

type TextInputHandle = React.ElementRef<typeof TextInput>;

/** Space between the card's last row and the keyboard or the screen's edge (dp). */
const CARD_GAP = 16;

/**
 * The quick-add sheet (2.8): a card at the bottom of a see-through window over
 * the home screen (Android) or over the app (QuickAddHost). Amount first (keyboard
 * up at once), then the category, an optional title, Save. Tapping outside,
 * Close or Back leave without saving. Motion: useSheetMotion.
 */
export const QuickAddSheet: React.FC<QuickAddSheetProps> = ({kind, categoryId, ready, host, prefill}) => {
  const colors = useThemeColors();
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const amountRef = useRef<TextInputHandle>(null);
  const textRef = useRef<TextInputHandle>(null);
  // Laid out for no keyboard (clear of the gesture bar); useSheetMotion lifts
  // the card over the keyboard, minus the room the keyboard covers anyway.
  const bottomPadding = Math.max(insets.bottom, CARD_GAP) + 4;
  const {cardMotion, scrimMotion, leave, onRootLayout} = useSheetMotion(bottomPadding - CARD_GAP, host);
  const close = () => leave();
  const placement = {paddingBottom: bottomPadding};

  return (
    <View style={[gs.flex1, styles.bottom]} onLayout={onRootLayout}>
      {host.drawsScrim ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.scrim, scrimMotion]} />
      ) : null}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel={t('quickAdd.close')}
      />
      <Animated.View style={[styles.card, cardMotion, placement, {backgroundColor: colors.primaryBackground}]}>
        <View style={[gs.row, gs.itemsCenter, gs.mb15]}>
          <PrimaryText size={18} weight="semibold" style={gs.flex1} accessibilityRole="header">
            {kind === 'income' ? t('quickAdd.incomeTitle') : t('quickAdd.expenseTitle')}
          </PrimaryText>
          <Pressable
            onPress={close}
            hitSlop={hitSlop}
            accessibilityRole="button"
            accessibilityLabel={t('quickAdd.close')}
            style={[gs.size40, gs.center]}>
            <Icon name="x" size={22} color={colors.secondaryText} />
          </Pressable>
        </View>
        {ready ? (
          <QuickAddForm
            kind={kind}
            categoryId={categoryId}
            amountRef={amountRef}
            textRef={textRef}
            leave={leave}
            openFull={host.openFull}
            prefill={prefill}
          />
        ) : (
          <View>
            <PrimaryText color={colors.secondaryText} style={gs.mb20}>
              {t('quickAdd.notReady')}
            </PrimaryText>
            <PrimaryButton
              colors={colors}
              buttonTitle={t('quickAdd.openZero')}
              onPress={() => leave(() => host.openFull('expense'))}
            />
          </View>
        )}
      </Animated.View>
    </View>
  );
};

interface QuickAddFormProps {
  kind: QuickAddKind;
  categoryId: string;
  amountRef: React.RefObject<TextInputHandle | null>;
  textRef: React.RefObject<TextInputHandle | null>;
  leave: (then?: () => void) => void;
  openFull: QuickAddHost['openFull'];
  prefill?: QuickAddPrefill;
}

const QuickAddForm: React.FC<QuickAddFormProps> = ({
  kind,
  categoryId,
  amountRef,
  textRef,
  leave,
  openFull,
  prefill,
}) => {
  const colors = useThemeColors();
  const {t} = useTranslation();
  const form = useQuickAdd(kind, categoryId, leave, openFull, prefill);

  const selected = form.categories?.filter(c => c.id === form.categoryId) ?? [];

  return (
    <View>
      <AmountInput
        ref={amountRef}
        // The keyboard comes up with the sheet: the amount is what the user came to type.
        autoFocus
        value={form.amount}
        onChangeText={form.setAmount}
        accessibilityLabel={t('quickAdd.amount')}
        // iOS 26+ floats a return key over the number pad's top edge, on top of Save; there the
        // next field is a tap away, so the amount field has none.
        returnKeyType={Platform.OS === 'android' ? 'next' : undefined}
        onSubmitEditing={() => textRef.current?.focus()}
        style={gs.mb15}
      />
      {kind === 'expense' ? (
        // The row's height is kept from the first frame, so the card does not
        // grow when the categories arrive a moment after it appears.
        <View style={styles.chips}>
          {form.categories && form.categories.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <CategoryContainer
                categories={form.categories}
                selectedCategories={selected}
                toggleCategorySelection={c => form.setCategoryId(c.id ?? '')}
                colors={colors}
                nowrap
              />
            </ScrollView>
          ) : null}
        </View>
      ) : null}
      <TextInput
        ref={textRef}
        value={form.text}
        onChangeText={form.setText}
        placeholder={kind === 'income' ? t('quickAdd.note') : t('quickAdd.whatFor')}
        placeholderTextColor={colors.secondaryText}
        returnKeyType="done"
        onSubmitEditing={() => logRejection(form.save())}
        maxLength={kind === 'income' ? undefined : 25}
        accessibilityLabel={kind === 'income' ? t('quickAdd.note') : t('quickAdd.whatFor')}
        style={[
          styles.text,
          {color: colors.primaryText, backgroundColor: colors.secondaryAccent, borderColor: colors.inputBorder},
        ]}
      />
      <View style={[gs.row, gs.gap10, gs.mt15]}>
        <View style={gs.flex1}>
          <PrimaryButton
            colors={colors}
            variant="outline"
            buttonTitle={t('quickAdd.moreDetails')}
            onPress={form.moreDetails}
            fullWidth
          />
        </View>
        <View style={gs.flex1}>
          <PrimaryButton
            colors={colors}
            buttonTitle={t('quickAdd.save')}
            onPress={() => logRejection(form.save())}
            disabled={!form.isValid}
            loading={form.saving}
            fullWidth
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bottom: {justifyContent: 'flex-end'},
  // Material's scrim, drawn by the sheet only where no window dims behind it.
  scrim: {backgroundColor: 'rgba(0,0,0,0.32)'},
  // One chip (48 dp touch target) and its bottom margin, reserved before the chips load.
  chips: {minHeight: 56, marginBottom: 10},
  card: {borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 16},
  text: {minHeight: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 15, fontSize: 15},
});
