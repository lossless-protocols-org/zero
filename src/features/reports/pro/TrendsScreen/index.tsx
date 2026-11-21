import React, {useCallback, useMemo, useState} from 'react';
import {ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {PrimaryView} from '../../../../ui/atoms/PrimaryView';
import {AppHeader} from '../../../../ui/atoms/AppHeader';
import {PrimaryText} from '../../../../ui/atoms/PrimaryText';
import {Icon} from '../../../../ui/atoms/Icons';
import {SegmentedTabs} from '../../../../ui/atoms/SegmentedTabs';
import {Amount} from '../../../../ui/atoms/Amount';
import {ProSlot} from '../../../../ui/atoms/ProSlot';
import {useThemeColors} from '../../../../ui/hooks/useThemeColors';
import {useFormatAmount} from '../../../../ui/hooks/useFormatAmount';
import {useMonthStartDay} from '../../../../ui/hooks/useMonthStartDay';
import {useAppSelector} from '../../../../store/hooks';
import {selectCategoryData} from '../../../../store/slices/categoryDataSlice';
import {displayCategoryName} from '../../../../i18n/displayNames';
import {formatMonthLabel, getMonthNamesShort} from '../../../../platform/dateFormat';
import {goBack} from '../../../../platform/navigationUtils';
import {logRejection} from '../../../../platform/errorLog';
import {monthIndexOfKey} from '../../../../domain/period';
import {
  categorySeries,
  changeOf,
  topCategories,
  trendColumns,
  usualSpending,
  type TrendPoint,
} from '../../../../domain/trends';
import type {TrendTile} from '../../../../domain/trendTiles';
import {gs} from '../../../../ui/globalStyles';
import {TrendCategoryRows} from '../../components/TrendCategoryRows';
import {TrendColumns} from '../../components/TrendColumns';
import {TrendRangeSwitch} from '../../components/TrendRangeSwitch';
import {TrendTiles} from '../../components/TrendTiles';
import {TREND_CHOICES, useTrends, type TrendLength} from '../../hooks/useTrends';
import {useReportWords} from '../../hooks/useReportWords';
import {useSharePdf} from '../../hooks/useSharePdf';
import {insightText} from '../../insightText';
import {trendsReportDoc} from '../../reportDocs';

/** The categories listed under the chart: the ones that matter in the months shown. */
const MAX_CATEGORIES = 6;

/**
 * Trends (3.0 Pro, plan P12; redesigned as one chart): the user's last 3, 6
 * or 12 months as columns, each as tall as the money that came in and split
 * into spent and kept, with the figures of the tapped month above them; what
 * stood out in the last finished month as tiles; and the categories that
 * matter, each of which can take over the chart. Every figure is a sum of the
 * user's own entries, read by the same rules as Home and Reports; nothing is
 * forecast and nothing is advised.
 */
export const TrendsScreen = () => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const formatAmount = useFormatAmount();
  const [length, setLength] = useState<TrendLength>(6);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const trends = useTrends(length);
  const categories = useAppSelector(selectCategoryData);
  const {words, format} = useReportWords();
  const pdf = useSharePdf();
  const startDay = useMonthStartDay();

  const categoryName = useCallback(
    (id: string): string => {
      const found = categories.find(category => category.id === id);
      return found ? displayCategoryName(found.name, t) : t('reports.pdfUncategorised');
    },
    [categories, t],
  );
  // A month is named by the month it starts in, whatever day that is: "Jun 7" under a column read as one day.
  const shortLabel = (point: TrendPoint): string => getMonthNamesShort()[monthIndexOfKey(point.key)] ?? point.key;
  const fullLabel = (point: TrendPoint): string => formatMonthLabel(point.period, 'monthYear');

  const shown = trends.ready ? trends.shown : NO_POINTS;
  const tops = useMemo(() => topCategories(shown, MAX_CATEGORIES), [shown]);
  // A picked category that is no longer listed (a shorter stretch) falls back to all spending.
  const category = categoryId !== null && tops.includes(categoryId) ? categoryId : null;
  const chart = useMemo(() => trendColumns(shown, category ?? undefined), [shown, category]);
  // The newest month is still running: it is drawn paler and is in no average.
  const newest = shown.at(-1) ?? null;
  const usual = usualSpending(shown.slice(0, -1), category ?? undefined);
  const usualShare = usual !== null && usual > 0 && chart.scale > 0 ? Math.min(usual / chart.scale, 1) : null;

  const finished = trends.ready ? trends.finished : null;
  // The month whose figures are shown: the tapped one, else the last finished one. The newest is
  // still running, and an unfinished month is no headline (and is never compared with a whole one).
  const selected =
    shown.find(point => point.key === pickedKey) ?? shown.find(point => point.key === finished?.key) ?? newest;
  const running = selected !== null && selected === newest;
  const selectedIndex = selected ? shown.indexOf(selected) : -1;
  const previous: TrendPoint | null =
    selectedIndex > 0 ? (shown[selectedIndex - 1] ?? null) : trends.ready ? trends.beforeShown : null;
  const soFar = (point: TrendPoint, label: string): string =>
    point === newest ? t('trends.thisMonthSoFar', {month: label}) : label;

  // Whole units in a sentence: paise in an average are noise.
  const money = (amount: number): string => formatAmount(Math.round(amount));
  const insightLines = trends.ready ? trends.insights.map(insight => insightText(insight, t, money, categoryName)) : [];

  const tileView = (tile: TrendTile, index: number) => {
    const key = `${tile.kind}-${index}`;
    if (tile.kind === 'keptShareChange') {
      const up = tile.direction === 'up';
      return {
        key,
        figure: t(up ? 'trends.tilePointsUp' : 'trends.tilePointsDown', {count: tile.value}),
        words: t('trends.tileKeptChange', {usual: tile.usual}),
        spoken: t(up ? 'trends.tileKeptUpSpoken' : 'trends.tileKeptDownSpoken', {
          count: tile.value,
          share: tile.share,
          usual: tile.usual,
        }),
      };
    }
    const spoken = insightText(tile.insight, t, money, categoryName);
    const change = (direction: 'up' | 'down'): string =>
      t(direction === 'up' ? 'trends.changeUp' : 'trends.changeDown', {percent: tile.value});
    switch (tile.kind) {
      case 'keptShare':
        return {
          key,
          spoken,
          figure: t('trends.percent', {percent: tile.value}),
          words: t('trends.tileKept'),
          tone: 'good' as const,
        };
      case 'spentMoreThanReceived':
        return {key, spoken, figure: money(tile.value), words: t('trends.tileOver'), tone: 'bad' as const};
      case 'biggestCategory':
        return {
          key,
          spoken,
          figure: t('trends.percent', {percent: tile.value}),
          words: t('trends.tileBiggest', {name: categoryName(tile.categoryId)}),
        };
      case 'spendingAgainstUsual':
        return {key, spoken, figure: change(tile.direction), words: t('trends.tileUsual')};
      case 'lowestSpending':
      case 'highestSpending':
        return {
          key,
          spoken,
          figure: t(tile.kind === 'lowestSpending' ? 'trends.tileLowest' : 'trends.tileHighest'),
          words: t('trends.tileOfMonths', {count: tile.value}),
        };
      case 'categoryAgainstUsual':
        return {
          key,
          spoken,
          figure: change(tile.direction),
          words: t('trends.tileCategory', {name: categoryName(tile.categoryId)}),
        };
    }
  };
  const tiles = trends.ready ? trends.tiles.map(tileView) : [];

  const categoryRows = selected
    ? tops.map(id => {
        const amount = selected.byCategory[id] ?? 0;
        // The month still running is not set against a whole one.
        const {percent} = !running && previous ? changeOf(amount, previous.byCategory[id] ?? 0) : NO_CHANGE;
        const name = categoryName(id);
        const moved = previous !== null && percent !== null && percent !== 0;
        return {
          id,
          name,
          series: categorySeries(shown, id),
          amount: formatAmount(amount),
          change: moved ? t(percent > 0 ? 'trends.changeUp' : 'trends.changeDown', {percent: Math.abs(percent)}) : null,
          spoken: [
            name,
            formatAmount(amount),
            moved
              ? t(percent > 0 ? 'trends.changeUpSpoken' : 'trends.changeDownSpoken', {
                  percent: Math.abs(percent),
                  month: fullLabel(previous),
                })
              : '',
          ]
            .filter(Boolean)
            .join(', '),
        };
      })
    : [];

  const sharePdf = () => {
    const first = shown[0];
    const last = shown.at(-1);
    if (!first || !last) {
      return Promise.resolve();
    }
    return pdf.share(
      () =>
        trendsReportDoc(
          {
            // "Jun 2026 – Nov 2026" for calendar months; with a start day, the stretch's first and last day,
            // with the year (a document is read later).
            rangeLabel:
              Number(first.period.start.slice(8, 10)) === 1
                ? t('reports.rangeLabel', {from: fullLabel(first), to: fullLabel(last)})
                : formatMonthLabel({start: first.period.start, next: last.period.next}, 'monthYear', 0),
            months: shown.map(point => ({label: fullLabel(point), point})),
            insights: insightLines,
            categories: categories.map(item => ({id: item.id ?? '', name: displayCategoryName(item.name, t)})),
          },
          // The heading names the month the facts are about, as the screen's does.
          finished ? {...words, whatStoodOut: t('trends.stoodOut', {month: fullLabel(finished)})} : words,
          format,
        ),
      `zero trends ${first.key} ${last.key}`,
    );
  };

  const card = [gs.p15, gs.rounded12, gs.mb15, {backgroundColor: colors.containerColor}];
  const figure = (
    key: string,
    label: string,
    spoken: string,
    value: string,
    more?: {color?: string; swatch?: string; note?: string},
  ) => (
    <View key={key} style={styles.figure} accessible accessibilityLabel={spoken}>
      <View style={[gs.rowCenter, gs.gap4]}>
        {more?.swatch ? <View style={[styles.swatch, {backgroundColor: more.swatch}]} /> : null}
        <PrimaryText size={11} color={colors.secondaryText}>
          {label}
        </PrimaryText>
      </View>
      <Amount size={16} weight="semibold" color={more?.color}>
        {value}
      </Amount>
      {more?.note ? (
        <PrimaryText size={11} color={colors.secondaryText}>
          {more.note}
        </PrimaryText>
      ) : null}
    </View>
  );
  const fieldValue = (field: string, value: string): string => t('common.fieldValue', {field, value});

  return (
    <PrimaryView colors={colors}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={gs.pb80}>
        <View style={[gs.mb20, gs.mt20]}>
          <AppHeader
            onPress={goBack}
            colors={colors}
            text={t('trends.title')}
            rightAction={
              <ProSlot feature="reports">
                <TouchableOpacity
                  onPress={() => logRejection(sharePdf())}
                  disabled={pdf.sharing || !trends.ready || trends.empty}
                  accessibilityRole="button"
                  accessibilityLabel={t('reports.sharePdf')}
                  accessibilityState={{busy: pdf.sharing}}
                  style={[gs.minTouch, pdf.sharing && gs.opacity50]}>
                  <Icon name="share-2" size={20} color={colors.primaryText} />
                </TouchableOpacity>
              </ProSlot>
            }
          />
        </View>

        {/* Trends is a second view of Reports, not a place apart: the same control sits on both. */}
        <View style={gs.mb15}>
          <SegmentedTabs<'month' | 'trends'>
            tabs={[
              {key: 'month', label: t('reports.tabMonth')},
              {key: 'trends', label: t('reports.tabTrends')},
            ]}
            value="trends"
            onChange={key => (key === 'month' ? goBack() : undefined)}
            colors={colors}
          />
        </View>

        {!trends.ready ? (
          trends.failed ? (
            <PrimaryText size={13} color={colors.accentRed} accessibilityLiveRegion="polite">
              {t('trends.loadFailed')}
            </PrimaryText>
          ) : null
        ) : trends.empty || !selected || !newest ? (
          <PrimaryText size={13} color={colors.secondaryText}>
            {t('trends.empty')}
          </PrimaryText>
        ) : (
          <>
            <View style={card}>
              <View style={[gs.rowBetweenCenter, gs.wrap, gs.gap8]}>
                <PrimaryText size={14} weight="semibold" style={gs.flexShrink} accessibilityRole="header">
                  {soFar(selected, fullLabel(selected))}
                </PrimaryText>
                <TrendRangeSwitch
                  choices={TREND_CHOICES.map(key => ({
                    key,
                    label: t(`trends.range${key}`),
                    spoken: t('trends.months', {count: key}),
                  }))}
                  value={length}
                  onChange={setLength}
                />
              </View>

              {/* The figures of the tapped month. They wrap onto more lines when the text is large. */}
              <View style={[gs.row, gs.wrap, gs.itemsStart, gs.gap12, gs.mt10, gs.mb12]}>
                {category === null ? (
                  <>
                    {figure(
                      'received',
                      t('trends.moneyIn'),
                      fieldValue(t('trends.received'), formatAmount(selected.received)),
                      formatAmount(selected.received),
                    )}
                    {figure(
                      'spent',
                      t('trends.spent'),
                      fieldValue(t('trends.spent'), formatAmount(selected.spent)),
                      formatAmount(selected.spent),
                      {swatch: colors.secondaryText},
                    )}
                    {figure(
                      'kept',
                      t('trends.kept'),
                      fieldValue(t('trends.kept'), formatAmount(selected.kept)),
                      formatAmount(selected.kept),
                      {
                        swatch: colors.accentGreen,
                        // Below zero the figure says so itself (its sign), as well as its colour.
                        color: selected.kept >= 0 ? colors.accentGreen : colors.accentRed,
                        note:
                          selected.received > 0
                            ? t('trends.keptShare', {percent: Math.round((selected.kept / selected.received) * 100)})
                            : undefined,
                      },
                    )}
                  </>
                ) : (
                  <>
                    {figure(
                      'category',
                      t('trends.spentOn', {name: categoryName(category)}),
                      fieldValue(
                        t('trends.spentOn', {name: categoryName(category)}),
                        formatAmount(selected.byCategory[category] ?? 0),
                      ),
                      formatAmount(selected.byCategory[category] ?? 0),
                      {swatch: colors.secondaryText},
                    )}
                    <TouchableOpacity
                      onPress={() => setCategoryId(null)}
                      accessibilityRole="button"
                      style={[gs.px12, gs.rounded12, gs.minTouch, {backgroundColor: colors.secondaryAccent}]}>
                      <PrimaryText size={12} weight="semibold" color={colors.secondaryText}>
                        {t('trends.allCategories')}
                      </PrimaryText>
                    </TouchableOpacity>
                  </>
                )}
              </View>

              <TrendColumns
                columns={shown.map((point, index) => ({
                  key: point.key,
                  label: shortLabel(point),
                  spoken:
                    category === null
                      ? t('trends.columnLabel', {
                          month: soFar(point, formatMonthLabel(point.period)),
                          received: formatAmount(point.received),
                          spent: formatAmount(point.spent),
                          kept: formatAmount(point.kept),
                        })
                      : t('trends.barLabel', {
                          month: soFar(point, formatMonthLabel(point.period)),
                          value: formatAmount(point.byCategory[category] ?? 0),
                        }),
                  spent: chart.columns[index]?.spent ?? 0,
                  kept: chart.columns[index]?.kept ?? 0,
                  over: chart.columns[index]?.over ?? 0,
                }))}
                selectedKey={selected.key}
                runningKey={newest.key}
                usual={usualShare}
                onSelect={setPickedKey}
              />

              <View style={[gs.rowCenter, gs.wrap, gs.gap8, gs.mt8]}>
                {usualShare === null ? null : (
                  <View style={[gs.rowCenter, gs.gap6]}>
                    <View style={[gs.row, gs.gap2]}>
                      {LEGEND_DASHES.map(dash => (
                        <View key={dash} style={[styles.dash, {backgroundColor: colors.primaryText}]} />
                      ))}
                    </View>
                    <PrimaryText size={11} color={colors.secondaryText}>
                      {t('trends.usualLegend')}
                    </PrimaryText>
                  </View>
                )}
                <PrimaryText size={11} color={colors.secondaryText} style={gs.flexShrink}>
                  {startDay === 1
                    ? t('trends.monthStillRunning', {month: shortLabel(newest)})
                    : t('trends.startsOn', {day: startDay})}
                </PrimaryText>
              </View>
              {trends.finishedMonths < 2 ? (
                <PrimaryText size={12} color={colors.secondaryText} style={gs.mt8}>
                  {t('trends.needTwoMonths')}
                </PrimaryText>
              ) : null}
            </View>

            {finished && (tiles.length > 0 || trends.finishedMonths >= 2) ? (
              <View style={gs.mb15}>
                <PrimaryText
                  size={11}
                  weight="semibold"
                  color={colors.accentGreen}
                  style={[styles.heading, gs.mb6]}
                  accessibilityRole="header">
                  {t('trends.stoodOutIn', {month: shortLabel(finished)})}
                </PrimaryText>
                {tiles.length === 0 ? (
                  <PrimaryText size={13}>{t('trends.nothingStoodOut', {month: fullLabel(finished)})}</PrimaryText>
                ) : (
                  <TrendTiles tiles={tiles} />
                )}
              </View>
            ) : null}

            <TrendCategoryRows
              title={t('trends.categories')}
              trailing={t('trends.months', {count: shown.length})}
              rows={categoryRows}
              selectedId={category}
              hint={t('trends.showInChart')}
              onPress={id => setCategoryId(current => (current === id ? null : id))}
            />
          </>
        )}
      </ScrollView>
    </PrimaryView>
  );
};

const NO_POINTS: readonly TrendPoint[] = [];
const NO_CHANGE = {percent: null};
const LEGEND_DASHES = [0, 1, 2] as const;

const styles = StyleSheet.create({
  // Three to a row on a phone; fewer to a row when the text is large and a figure needs the width.
  figure: {flexGrow: 1, flexBasis: 84},
  swatch: {width: 8, height: 8, borderRadius: 2},
  dash: {width: 4, height: 1},
  heading: {letterSpacing: 0.8, textTransform: 'uppercase'},
});
