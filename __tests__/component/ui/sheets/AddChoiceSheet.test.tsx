/**
 * What the plus asks when a screen lists more than one kind (round two, item
 * 6): each choice with its word and one line saying what it means; a tap
 * closes the sheet and then runs the choice.
 */
import React from 'react';
import {act, fireEvent, screen} from '@testing-library/react-native';
import {SheetManager} from 'react-native-actions-sheet';
import {AddChoiceSheet} from '../../../../src/ui/sheets/AddChoiceSheet';
import {renderInApp} from '../../../harness/render';

jest.mock('react-i18next', () => require('../../../harness/mocks/reactI18next'));
jest.mock('../../../../src/ui/atoms/CustomBottomSheet', () => ({
  CustomBottomSheet: ({children}: {children: React.ReactNode}) => children,
}));

it('lists every choice with its meaning and runs the one tapped after the sheet closes', async () => {
  jest.useFakeTimers();
  const hide = jest.spyOn(SheetManager, 'hide').mockResolvedValue(undefined);
  const addCard = jest.fn();
  const addLoan = jest.fn();
  await renderInApp(
    <AddChoiceSheet
      sheetId="add-choice-sheet"
      payload={{
        title: 'Add to Debts',
        choices: [
          {name: 'card', icon: 'credit-card', label: 'Card', hint: 'You spend first and pay later', onPress: addCard},
          {name: 'loan', icon: 'hand-coins', label: 'Loan', hint: 'You pay it back in parts', onPress: addLoan},
        ],
      }}
    />,
  );
  expect(screen.getByText('Card')).toBeTruthy();
  expect(screen.getByText('You pay it back in parts')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('add-choice-loan'));
  expect(hide).toHaveBeenCalledWith('add-choice-sheet');
  // The form opens once the sheet has finished closing.
  expect(addLoan).not.toHaveBeenCalled();
  await act(() => {
    jest.advanceTimersByTime(300);
  });
  expect(addLoan).toHaveBeenCalledTimes(1);
  expect(addCard).not.toHaveBeenCalled();
  jest.useRealTimers();
});
