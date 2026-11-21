import React, {useCallback, useMemo, useState} from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {PrimaryText} from '../atoms/PrimaryText';
import {Amount} from '../atoms/Amount';
import {Icon} from '../atoms/Icons';
import {useThemeColors} from '../hooks/useThemeColors';
import {useFormatAmount} from '../hooks/useFormatAmount';
import {gs} from '../globalStyles';

interface BudgetMeterProps {
  /** The month against its budget (domain/budgetMath.budgetStatus); only what the meter draws. */
  status: {
    amount: number;
    exceeded: boolean;
    over: number;
    /** Spent, as 0–100 of the budget. */
    fill: number;
    /** Bills still due, as 0–100 of the budget, never past its end. */
    billsFill: number;
    billsStillDue: number;
    free: number;
    dailyLeft: number;
  };
  /** A past (or future) month has no "today". */
  isCurrentMonth: boolean;
  /** Opens the list of what is coming up. */
  onBillsPress: () => void;
}

/** Below these shares of the budget a part is too thin for its label, which then goes under the meter. */
const FREE_LABEL_MIN = 34;
const SPENT_LABEL_MIN = 20;
/** From this system text size on, no label fits inside a part: all of them go under the meter. */
const LARGE_TEXT_SCALE = 1.3;

const BILLS_HIT_SLOP = {top: 12, bottom: 12, left: 12, right: 12};

const STRIPE_WIDTH = 3;
const STRIPE_GAP = 5;
/** How far the slanted stripes run past the part on every side, so its corners stay covered. */
const STRIPE_BLEED = 30;

/** Diagonal stripes over the bills part: its meaning without colour. Plain views, as many as the part is wide. */
const Stripes = React.memo(({color}: {color: string}) => {
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  }, []);
  const count = Math.ceil((width + 2 * STRIPE_BLEED) / (STRIPE_WIDTH + STRIPE_GAP));
  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout}>
      <View style={[styles.stripes, gs.opacity50]}>
        {Array.from({length: count}, (_, index) => (
          <View key={index} style={[styles.stripe, {backgroundColor: color}]} />
        ))}
      </View>
    </View>
  );
});

/**
 * Home's budget card (ZERO_3.0_TO_FIX_APPROVED A5): the card is the budget,
 * divided in proportion from the start edge: spent (pale), free (green, with
 * the card's largest figure) and bills still due (striped). One line under
 * it: what is left today, and the bills, which open Coming up.
 *
 * One element for a screen reader, read as one sentence; the bills link is
 * its action, and stays a button of its own where the platform reaches it.
 */
export const BudgetMeter = React.memo(({status, isCurrentMonth, onBillsPress}: BudgetMeterProps) => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const formatAmount = useFormatAmount();
  const {fontScale} = useWindowDimensions();
  const {amount, exceeded, over, fill, billsFill, billsStillDue, free, dailyLeft} = status;

  const hasBills = billsStillDue > 0;
  // Over budget the whole meter is the spent part: nothing is free, and no room is left to show bills in.
  const spentShare = exceeded ? 100 : fill;
  const billsShare = exceeded ? 0 : billsFill;
  const freeShare = exceeded ? 0 : Math.max(100 - fill - billsFill, 0);

  const largeText = fontScale >= LARGE_TEXT_SCALE;
  // The card's big figure: what is free, or how far over. Inside its part when that is wide enough.
  const figure = formatAmount(exceeded ? over : free);
  const figureLabel = t(exceeded ? 'home.meterOver' : 'home.meterFree');
  const figureInside = !largeText && (exceeded || freeShare >= FREE_LABEL_MIN);
  const spentLabelInside = !largeText && !exceeded && spentShare >= SPENT_LABEL_MIN;
  const labelsInside = figureInside || spentLabelInside;

  // Whole units, as the daily line always was; a share that rounds to nothing is used up.
  const todayLeft = Math.round(dailyLeft);
  const todayUsedUp = todayLeft <= 0;
  const todaySentence = !isCurrentMonth
    ? ''
    : todayLeft < 0
      ? t('home.amountOverToday', {amount: formatAmount(-todayLeft)})
      : t('home.amountLeftToday', {amount: formatAmount(todayLeft)});
  const todayText =
    isCurrentMonth && !todayUsedUp ? t('home.meterTodayLeft', {amount: formatAmount(todayLeft)}) : todaySentence;
  const billsText = formatAmount(billsStillDue);

  // Separate facts joined for a screen reader, each a whole sentence part of its own.
  const label = [
    exceeded
      ? t('home.meterOverOf', {amount: figure, budget: formatAmount(amount)})
      : t('home.meterFreeOf', {amount: figure, budget: formatAmount(amount)}),
    todaySentence,
    hasBills ? t('home.meterHeldForBills', {amount: billsText}) : '',
  ]
    .filter(Boolean)
    .join(', ');
  const actions = useMemo(() => (hasBills ? [{name: 'bills', label: t('home.meterOpenBills')}] : []), [hasBills, t]);
  const onAction = useCallback(
    (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === 'bills') {
        onBillsPress();
      }
    },
    [onBillsPress],
  );

  const figureBlock = (color: string) => (
    <View style={[gs.px10, gs.py8, gs.flex1, gs.justifyCenter]}>
      <PrimaryText size={11} color={color} numberOfLines={1}>
        {figureLabel}
      </PrimaryText>
      <Amount size={20} weight="bold" color={color}>
        {figure}
      </Amount>
    </View>
  );

  return (
    <View
      accessible
      accessibilityLabel={label}
      accessibilityActions={actions}
      onAccessibilityAction={onAction}
      testID="budget-meter"
      style={gs.mt6}>
      <View style={[gs.row, gs.rounded12, gs.overflowHidden, labelsInside ? styles.meter : styles.meterBare]}>
        {spentShare > 0 ? (
          <View
            testID="budget-meter-spent"
            style={{flex: spentShare, backgroundColor: exceeded ? colors.accentOrange : colors.secondaryAccent}}>
            {exceeded && figureInside ? figureBlock(colors.buttonText) : null}
            {spentLabelInside ? (
              <View style={[gs.px10, gs.py8, gs.flex1, gs.justifyCenter]}>
                <PrimaryText size={11} color={colors.secondaryText} numberOfLines={1}>
                  {t('home.meterSpent')}
                </PrimaryText>
              </View>
            ) : null}
          </View>
        ) : null}
        {freeShare > 0 ? (
          <View testID="budget-meter-free" style={{flex: freeShare, backgroundColor: colors.accentGreen}}>
            {figureInside ? figureBlock(colors.buttonText) : null}
          </View>
        ) : null}
        {billsShare > 0 ? (
          <View
            testID="budget-meter-bills"
            style={[gs.overflowHidden, {flex: billsShare, backgroundColor: colors.secondaryAccent}]}>
            <Stripes color={colors.accentGreen} />
          </View>
        ) : null}
      </View>

      {/* The big figure when its part is too thin for it, or the system text too large. */}
      {figureInside ? null : (
        <View style={[gs.rowBetweenCenter, gs.gap8, gs.mt6, gs.px3]}>
          <PrimaryText size={12} weight="semibold" color={colors.secondaryText}>
            {figureLabel}
          </PrimaryText>
          <Amount size={20} weight="bold" color={exceeded ? colors.accentOrange : colors.accentGreen}>
            {figure}
          </Amount>
        </View>
      )}

      {todayText || hasBills ? (
        <View
          style={[
            gs.row,
            gs.wrap,
            gs.itemsCenter,
            todayText ? gs.justifyBetween : gs.justifyEnd,
            gs.gap8,
            gs.mt6,
            gs.px3,
          ]}>
          {todayText ? (
            <Amount size={12} color={todayUsedUp ? colors.accentOrange : colors.primaryText}>
              {todayText}
            </Amount>
          ) : null}
          {hasBills ? (
            <TouchableOpacity
              onPress={onBillsPress}
              activeOpacity={0.6}
              hitSlop={BILLS_HIT_SLOP}
              accessibilityRole="button"
              accessibilityHint={t('home.meterOpenBills')}
              style={[gs.rowCenter, gs.gap2, gs.flexShrink]}>
              <Amount size={12} weight="medium" color={colors.secondaryText}>
                {t('home.meterBillsDue', {amount: billsText})}
              </Amount>
              <Icon name="chevron-right" size={12} color={colors.secondaryText} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  // Tall enough for a label and the figure; grows with them.
  meter: {minHeight: 60},
  // No label inside: a plain proportion bar.
  meterBare: {height: 14},
  stripes: {
    position: 'absolute',
    top: -STRIPE_BLEED,
    bottom: -STRIPE_BLEED,
    start: -STRIPE_BLEED,
    flexDirection: 'row',
    gap: STRIPE_GAP,
    transform: [{rotate: '20deg'}],
  },
  stripe: {width: STRIPE_WIDTH},
});
