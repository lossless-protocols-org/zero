import React, {useCallback, useState} from 'react';
import {ScrollView, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {PrimaryView} from '../../../../ui/atoms/PrimaryView';
import {AppHeader} from '../../../../ui/atoms/AppHeader';
import {PrimaryText} from '../../../../ui/atoms/PrimaryText';
import {PrimaryButton} from '../../../../ui/atoms/PrimaryButton';
import {Amount} from '../../../../ui/atoms/Amount';
import {DatePicker} from '../../../../ui/atoms/DatePicker';
import {ProSlot} from '../../../../ui/atoms/ProSlot';
import {useThemeColors} from '../../../../ui/hooks/useThemeColors';
import {useFormatAmount} from '../../../../ui/hooks/useFormatAmount';
import {usePreference} from '../../../../ui/hooks/usePreference';
import {isIsoDay, toDayKey} from '../../../../domain/dates';
import type {IsoDay} from '../../../../domain/types';
import {displayCategoryName} from '../../../../i18n/displayNames';
import {formatDisplayDate, getWeekdayShortNames} from '../../../../platform/dateFormat';
import {rotateWeekdays, weekStartPreference} from '../../../../platform/weekStart';
import {goBack} from '../../../../platform/navigationUtils';
import {logRejection} from '../../../../platform/errorLog';
import {gs} from '../../../../ui/globalStyles';
import {MonthCalendarHeatmap} from '../../components/MonthCalendarHeatmap';
import {CategoryDonut} from '../../components/CategoryDonut';
import {MoneyInStrip} from '../../components/MoneyInStrip';
import {useRangeReport} from '../../hooks/useRangeReport';
import {useReportWords} from '../../hooks/useReportWords';
import {useSharePdf} from '../../hooks/useSharePdf';
import {spendingReportDoc} from '../../reportDocs';

/** Past this many days the calendar would be taller than the rest of the screen: the figures and the donut carry it. */
const HEATMAP_MAX_DAYS = 62;

/**
 * Reports for any two days (3.0 Pro, plan P11): pick From and To, and the
 * screen shows what Reports shows for a month, by the same rules: the total
 * and daily average, money in and kept, the calendar and where it went. A
 * range has no budget (budgets are a month's), and a category does not open
 * a list (that list is a month's too).
 */
export const RangeReportScreen = () => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const formatAmount = useFormatAmount();
  const range = useRangeReport();
  const {words, format} = useReportWords();
  const pdf = useSharePdf();
  const weekStart = usePreference(weekStartPreference);
  const [showFrom, setShowFrom] = useState(false);
  const [showTo, setShowTo] = useState(false);
  const todayDate = new Date();

  const pick = (apply: (day: IsoDay) => void) => (value: string) => {
    const day = toDayKey(value);
    if (isIsoDay(day)) {
      apply(day);
    }
  };
  const label = t('reports.rangeLabel', {
    from: formatDisplayDate(range.from, 'date'),
    to: formatDisplayDate(range.to, 'date'),
  });

  const sharePdf = useCallback(
    () =>
      pdf.share(
        () =>
          spendingReportDoc(
            {
              periodLabel: label,
              days: range.days,
              expenses: range.expenses,
              refunds: range.refunds,
              received: range.totals.received,
              budget: null,
              categoryName: name => displayCategoryName(name, t),
            },
            words,
            // Two rows a year apart must not both read "5 Dec".
            range.from.slice(0, 4) === range.to.slice(0, 4)
              ? format
              : {...format, day: (date: string) => formatDisplayDate(date, 'date')},
          ),
        `zero ${range.from} ${range.to}`,
      ),
    [pdf, label, range, words, format, t],
  );

  const tile = (field: string, value: string) => (
    <View
      accessible
      accessibilityLabel={t('common.fieldValue', {field, value})}
      style={[gs.flex1, gs.px12, gs.py10, gs.rounded8, {backgroundColor: colors.secondaryAccent}]}>
      <PrimaryText size={11} color={colors.secondaryText} numberOfLines={1} adjustsFontSizeToFit>
        {field}
      </PrimaryText>
      <Amount size={14} weight="semibold">
        {value}
      </Amount>
    </View>
  );

  return (
    <PrimaryView colors={colors}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={gs.pb80}>
        <View style={[gs.mb20, gs.mt20]}>
          <AppHeader onPress={goBack} colors={colors} text={t('reports.rangeTitle')} />
        </View>

        <View style={[gs.row, gs.gap10]}>
          <View style={gs.flex1}>
            <DatePicker
              label={t('reports.rangeFrom')}
              createdAt={`${range.from}T09:00:00`}
              setCreatedAt={pick(range.pickFrom)}
              showDatePicker={showFrom}
              setShowDatePicker={setShowFrom}
              maxDate={todayDate}
            />
          </View>
          <View style={gs.flex1}>
            <DatePicker
              label={t('reports.rangeTo')}
              createdAt={`${range.to}T09:00:00`}
              setCreatedAt={pick(range.pickTo)}
              showDatePicker={showTo}
              setShowDatePicker={setShowTo}
              maxDate={todayDate}
            />
          </View>
        </View>
        <PrimaryText size={12} color={colors.secondaryText} style={gs.mb10}>
          {t('reports.rangeDays', {count: range.days})}
        </PrimaryText>

        {range.failed ? (
          <PrimaryText size={13} color={colors.accentRed} accessibilityLiveRegion="polite">
            {t('trends.loadFailed')}
          </PrimaryText>
        ) : range.ready ? (
          <>
            <View style={[gs.row, gs.gap6]}>
              {tile(t('reports.total'), formatAmount(range.totals.spent))}
              {tile(t('reports.avgPerDay'), formatAmount(range.totals.spent / range.days))}
            </View>

            {range.totals.received > 0 ? (
              <View style={gs.mt10}>
                <MoneyInStrip
                  colors={colors}
                  received={range.totals.received}
                  spent={range.totals.spent}
                  refunded={0}
                />
              </View>
            ) : null}
            {range.totals.refunded > 0 ? (
              <Amount weight="medium" size={12} color={colors.secondaryText} style={gs.mt8}>
                {t('reports.rangeBack', {amount: formatAmount(range.totals.refunded)})}
              </Amount>
            ) : null}

            {range.rows.length === 0 ? (
              <PrimaryText size={13} color={colors.secondaryText} style={gs.mt20}>
                {t('reports.rangeEmpty')}
              </PrimaryText>
            ) : (
              <>
                {range.days <= HEATMAP_MAX_DAYS ? (
                  <MonthCalendarHeatmap
                    transactions={range.rows}
                    period={range.period}
                    dayNames={rotateWeekdays(getWeekdayShortNames(), weekStart)}
                    weekStart={weekStart}
                  />
                ) : (
                  <PrimaryText size={12} color={colors.secondaryText} style={gs.mt10}>
                    {t('reports.rangeHeatmapTooLong')}
                  </PrimaryText>
                )}
                <View style={[gs.mt20, gs.mb20]}>
                  <CategoryDonut transactions={range.rows} categoryBudgets={NO_BUDGETS} />
                </View>
              </>
            )}

            <ProSlot feature="reports">
              <PrimaryButton
                onPress={() => logRejection(sharePdf())}
                colors={colors}
                buttonTitle={t('reports.sharePdf')}
                variant="outline"
                loading={pdf.sharing}
                disabled={pdf.sharing}
              />
            </ProSlot>
          </>
        ) : null}
      </ScrollView>
    </PrimaryView>
  );
};

const NO_BUDGETS = {};
