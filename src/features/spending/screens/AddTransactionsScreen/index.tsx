import React, {useState} from 'react';
import {View} from 'react-native';
import {ExpenseEntry} from '../../components/ExpenseEntry';
import {gs} from '../../../../ui/globalStyles';
import {markAddScreenReady} from '../../../../platform/startupMarker';
import {takeQuickAddDraft} from '../../../../ui/quickAddDraft';

const onFirstLayout = (): void => markAddScreenReady();

export const AddTransactionsScreen = () => {
  // What the quick-add sheet had typed, when the user asked for "More details" (once).
  const [draft] = useState(takeQuickAddDraft);
  return (
    <View style={gs.flex1} onLayout={onFirstLayout}>
      <ExpenseEntry draft={draft ?? undefined} />
    </View>
  );
};
