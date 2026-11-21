import React, {useCallback} from 'react';
import {ActivityIndicator, Linking, Platform, ScrollView, TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {SheetManager, type SheetProps} from 'react-native-actions-sheet';
import {PRIVACY_POLICY_URL, TERMS_URL} from '../../../constants/links';
import {formatDisplayDate} from '../../../platform/dateFormat';
import {appendErrorLog, logRejection} from '../../../platform/errorLog';
import type {EntitlementState, StoreProduct} from '../../../pro/schema';
import {SHIPPED_PRO_FEATURES, type ProFeature} from '../../../pro/features';
import {trialEndsAt, type UpgradeOffer} from '../../../pro/upgradeOffer';
import {CustomBottomSheet} from '../../../ui/atoms/CustomBottomSheet';
import {Icon} from '../../../ui/atoms/Icons';
import type {IconName} from '../../../ui/atoms/IconRegistry';
import {PrimaryButton} from '../../../ui/atoms/PrimaryButton';
import {PrimaryText} from '../../../ui/atoms/PrimaryText';
import {gs, hitSlop} from '../../../ui/globalStyles';
import {useEntitlement} from '../../../ui/hooks/useEntitlement';
import {useProActions} from '../../../ui/hooks/useProActions';
import {useThemeColors} from '../../../ui/hooks/useThemeColors';
import {PriceCard} from '../components/PriceCard';
import {useUpgrade} from '../hooks/useUpgrade';

/**
 * How each Pro feature is described on the sheet. Only the ones in
 * `SHIPPED_PRO_FEATURES` are drawn, so the sheet lists what this build does
 * and nothing it will do later.
 */
const HIGHLIGHTS = {
  accounts: {icon: 'landmark', key: 'pro.featureAccounts', more: 'pro.featureAccountsMore'},
  recurring: {icon: 'repeat', key: 'pro.featureRecurring', more: 'pro.featureRecurringMore'},
  incomeCategories: {icon: 'wallet', key: 'pro.featureIncome', more: 'pro.featureIncomeMore'},
  cloudBackup: {icon: 'shield-check', key: 'pro.featureBackup', more: 'pro.featureBackupMore'},
  monthStart: {icon: 'calendar', key: 'pro.featureMonthStart', more: 'pro.featureMonthStartMore'},
  trends: {icon: 'trending-up', key: 'pro.featureTrends', more: 'pro.featureTrendsMore'},
  reports: {icon: 'file-text', key: 'pro.featureReports', more: 'pro.featureReportsMore'},
} as const satisfies Partial<Record<ProFeature, {icon: IconName; key: string; more: string}>>;

type Described = keyof typeof HIGHLIGHTS;
const isDescribed = (feature: ProFeature): feature is Described => feature in HIGHLIGHTS;

/** States in which a subscription is running, so a second one is not offered. */
const SUBSCRIBED: readonly EntitlementState[] = ['trial', 'subscribed', 'grace'];

const openLink = (url: string): void => {
  Linking.openURL(url).catch((error: unknown) => appendErrorLog(error, false));
};

/**
 * The one place zero Pro is sold (3.0): what it adds, what stays free, and
 * each way to buy it with its price and terms in full before the button. The
 * prices are the store's own text. Opened only by a tap on the Settings row,
 * the what's-new screen or the ended notice; nothing opens it by itself.
 */
export const UpgradeSheet: React.FC<SheetProps<'upgrade-sheet'>> = ({sheetId}) => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const entitlement = useEntitlement();
  const close = useCallback(() => {
    void SheetManager.hide(sheetId);
  }, [sheetId]);
  const {state, buying, buy, retry} = useUpgrade(close);
  const {restore, restoring, manageSubscription} = useProActions();
  const android = Platform.OS === 'android';
  const busy = buying !== null || restoring;
  const ownsLifetime = entitlement.state === 'lifetime';
  const subscribed = SUBSCRIBED.includes(entitlement.state);
  // A payment is clearing: nothing more is sold until the store says how it ended.
  const clearing = entitlement.state === 'pending';
  const highlights = SHIPPED_PRO_FEATURES.filter(isDescribed).map(feature => HIGHLIGHTS[feature]);

  const monthlyCard = (product: StoreProduct) => {
    const price = product.displayPrice;
    // The date is today's, each time the sheet is drawn.
    const firstCharge = trialEndsAt(product, Date.now());
    const trial = firstCharge !== null;
    const terms = trial
      ? t(android ? 'pro.trialLineAndroid' : 'pro.trialLineIos', {
          days: product.trialDays,
          price,
          date: formatDisplayDate(new Date(firstCharge), 'dayMonth'),
        })
      : t(android ? 'pro.renewLineAndroid' : 'pro.renewLineIos');
    return (
      <PriceCard
        key={product.id}
        title={t('pro.monthly')}
        price={t('pro.pricePerMonth', {price})}
        terms={terms}
        action={trial ? t('pro.startTrial') : t('pro.subscribe')}
        onPress={() => logRejection(buy(product))}
        busy={buying === product.id}
        disabled={busy}
      />
    );
  };

  const lifetimeCard = (product: StoreProduct, offer: UpgradeOffer) => (
    <PriceCard
      key={product.id}
      title={t('pro.lifetime')}
      price={t('pro.priceOnce', {price: product.displayPrice})}
      terms={t('pro.lifetimeLine')}
      note={offer.usualLifetimePrice ? t('pro.thanksNote', {price: offer.usualLifetimePrice}) : null}
      action={t('pro.buyLifetime')}
      onPress={() => logRejection(buy(product))}
      busy={buying === product.id}
      disabled={busy}
    />
  );

  const cards = (offer: UpgradeOffer) => {
    // A subscriber may still buy lifetime; a lifetime owner has nothing left to buy.
    const monthly = offer.monthly && !subscribed && !ownsLifetime ? monthlyCard(offer.monthly) : null;
    const lifetime = offer.lifetime && !ownsLifetime ? lifetimeCard(offer.lifetime, offer) : null;
    return offer.lifetimeFirst ? [lifetime, monthly] : [monthly, lifetime];
  };

  return (
    <CustomBottomSheet
      sheetId={sheetId}
      header={{title: t('pro.title'), showCloseButton: true, onClosePress: close}}
      gestureEnabled>
      <ScrollView contentContainerStyle={[gs.px20, gs.pb10, gs.pt5, gs.gap12]} showsVerticalScrollIndicator={false}>
        <PrimaryText size={13} color={colors.secondaryText}>
          {t('pro.lead')}
        </PrimaryText>

        <View style={gs.gap8}>
          {highlights.length > 0 ? (
            <PrimaryText size={13} weight="semibold" accessibilityRole="header">
              {t('pro.adds')}
            </PrimaryText>
          ) : null}
          {/* Each feature as the row every other list uses, with what it does for the user under its name. */}
          {highlights.map(({icon, key, more}) => (
            <View
              key={key}
              style={[gs.rowCenter, gs.gap10]}
              accessible
              accessibilityLabel={[t(key), t(more)].join('. ')}>
              <View style={[gs.size36, gs.center, gs.rounded10, {backgroundColor: colors.primaryBackground}]}>
                <Icon name={icon} size={18} color={colors.accentGreen} />
              </View>
              <View style={[gs.flex1, gs.gap2]}>
                <PrimaryText size={14} weight="medium">
                  {t(key)}
                </PrimaryText>
                <PrimaryText size={11} color={colors.secondaryText}>
                  {t(more)}
                </PrimaryText>
              </View>
            </View>
          ))}
          <PrimaryText size={12} color={colors.secondaryText}>
            {t('pro.staysFree')}
          </PrimaryText>
        </View>

        {entitlement.alsoSubscribed ? (
          <View style={[gs.rounded12, gs.p14, gs.gap8, {backgroundColor: colors.containerColor}]}>
            <PrimaryText size={13}>{t('pro.alsoSubscribed')}</PrimaryText>
            <PrimaryButton
              onPress={() => logRejection(manageSubscription())}
              colors={colors}
              buttonTitle={t('pro.manage')}
              variant="outline"
            />
          </View>
        ) : null}

        {state.phase === 'loading' ? (
          <View
            style={[gs.center, gs.py12]}
            accessible
            accessibilityLabel={t('pro.loading')}
            accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.accentGreen} />
          </View>
        ) : null}
        {state.phase === 'unavailable' ? (
          <PrimaryText size={13} color={colors.secondaryText}>
            {t('pro.unavailable')}
          </PrimaryText>
        ) : null}
        {state.phase === 'empty' ? (
          <View style={gs.gap8}>
            <PrimaryText size={13} color={colors.secondaryText}>
              {t('pro.noProducts')}
            </PrimaryText>
            <PrimaryButton
              onPress={() => logRejection(retry())}
              colors={colors}
              buttonTitle={t('pro.tryAgain')}
              variant="outline"
            />
          </View>
        ) : null}
        {clearing ? <PrimaryText size={13}>{t('pro.pending')}</PrimaryText> : null}
        {state.phase === 'ready' && !clearing ? cards(state.offer) : null}

        {state.phase === 'unavailable' ? null : (
          <>
            <PrimaryButton
              onPress={() => logRejection(restore())}
              colors={colors}
              buttonTitle={t('pro.restore')}
              variant="ghost"
              loading={restoring}
              disabled={busy}
            />
            <PrimaryText size={11} color={colors.secondaryText}>
              {t('pro.accountNote')}
            </PrimaryText>
          </>
        )}

        <View style={[gs.rowCenter, gs.gap12, gs.center]}>
          <TouchableOpacity onPress={() => openLink(TERMS_URL)} hitSlop={hitSlop} accessibilityRole="link">
            <PrimaryText size={12} color={colors.secondaryText}>
              {t('pro.terms')}
            </PrimaryText>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => openLink(PRIVACY_POLICY_URL)} hitSlop={hitSlop} accessibilityRole="link">
            <PrimaryText size={12} color={colors.secondaryText}>
              {t('pro.privacy')}
            </PrimaryText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </CustomBottomSheet>
  );
};
