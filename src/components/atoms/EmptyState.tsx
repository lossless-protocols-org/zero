import {View, ViewStyle} from 'react-native';
import React, {ReactNode} from 'react';
import {useTranslation} from 'react-i18next';
import PrimaryText from './PrimaryText';
import type {ThemeColors} from '../../hooks/useThemeColors';
import Icon from './Icons';
import {gs} from '../../styles/globalStyles';
import {IconName} from './IconRegistry';

type EmptyStateType = 'Transactions' | 'Insights' | 'Debts' | 'Categories';

interface EmptyStateProps {
  colors: ThemeColors;
  type: EmptyStateType;
  style?: ViewStyle;
  message?: string;
  actionButton?: ReactNode;
}

const iconMap: Record<EmptyStateType, IconName> = {
  Transactions: 'receipt',
  Insights: 'bar-chart-3',
  Debts: 'hand-coins',
  Categories: 'shapes',
};

const messageKeyMap: Record<
  EmptyStateType,
  'emptyState.transactions' | 'emptyState.insights' | 'emptyState.debts' | 'emptyState.categories'
> = {
  Transactions: 'emptyState.transactions',
  Insights: 'emptyState.insights',
  Debts: 'emptyState.debts',
  Categories: 'emptyState.categories',
};

const EmptyState: React.FC<EmptyStateProps> = React.memo(({colors, type, style, message, actionButton}) => {
  const {t} = useTranslation();
  const displayMessage = message ?? t(messageKeyMap[type]);

  return (
    <View style={[gs.center, gs.mt30p, style]}>
      <View style={[gs.size50, gs.roundedFull, gs.center, {backgroundColor: colors.secondaryAccent}]}>
        <Icon name={iconMap[type]} size={22} color={colors.secondaryText} />
      </View>
      <PrimaryText size={13} color={colors.secondaryText} style={gs.mt10}>
        {displayMessage}
      </PrimaryText>
      {actionButton && <View style={gs.mt15}>{actionButton}</View>}
    </View>
  );
});

export default EmptyState;
