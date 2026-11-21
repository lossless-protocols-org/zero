import React, {useCallback} from 'react';
import {TouchableOpacity, View} from 'react-native';
import {SheetManager, type SheetProps} from 'react-native-actions-sheet';
import {CustomBottomSheet} from '../atoms/CustomBottomSheet';
import {PrimaryText} from '../atoms/PrimaryText';
import {Icon} from '../atoms/Icons';
import {useThemeColors} from '../hooks/useThemeColors';
import {gs} from '../globalStyles';

/** One thing the plus can add: its word, and one line saying what it means. */
export interface AddChoice {
  name: string;
  /** A lucide icon name. */
  icon: string;
  label: string;
  hint: string;
  onPress: () => void;
}

/**
 * What the plus asks when a screen lists more than one kind of thing (round
 * two, item 6): Spend or Save on Money; Person, Card or Loan on Debts. Each
 * choice carries one line that says what it means in words no country owns
 * (world review W2). A screen that lists one kind never opens this.
 */
export const AddChoiceSheet: React.FC<SheetProps<'add-choice-sheet'>> = React.memo(props => {
  const colors = useThemeColors();
  const {title, choices} = props.payload ?? {};

  const run = useCallback(
    (action: () => void) => {
      void SheetManager.hide(props.sheetId);
      // Let the sheet finish closing before the form opens.
      setTimeout(action, 250);
    },
    [props.sheetId],
  );

  return (
    <CustomBottomSheet
      sheetId={props.sheetId}
      header={{
        title: title ?? '',
        showCloseButton: true,
        onClosePress: () => {
          void SheetManager.hide(props.sheetId);
        },
      }}
      gestureEnabled>
      <View style={[gs.px20, gs.pb10, gs.pt5]}>
        {(choices ?? []).map(choice => (
          <TouchableOpacity
            key={choice.name}
            onPress={() => run(choice.onPress)}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel={choice.label}
            accessibilityHint={choice.hint}
            testID={`add-choice-${choice.name}`}
            style={[gs.rowCenter, gs.gap12, gs.py12]}>
            <View style={[gs.size36, gs.roundedFull, gs.center, {backgroundColor: colors.lightAccent}]}>
              <Icon dynamicName={choice.icon} size={16} color={colors.primaryText} />
            </View>
            <View style={gs.flex1}>
              <PrimaryText size={15} weight="medium">
                {choice.label}
              </PrimaryText>
              <PrimaryText size={12} color={colors.secondaryText}>
                {choice.hint}
              </PrimaryText>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </CustomBottomSheet>
  );
});
