/** "What's new in 3.0": what stays free comes first, and there are two ways out. */
import React from 'react';
import {fireEvent, screen} from '@testing-library/react-native';
import {SheetManager} from 'react-native-actions-sheet';
import {WhatsNewScreen} from '../../../../../src/features/pro/screens/WhatsNewScreen';
import * as navigationUtils from '../../../../../src/platform/navigationUtils';
import {renderWithTheme} from '../../../../harness/render';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));

beforeEach(() => {
  jest.spyOn(navigationUtils, 'goBack').mockReturnValue(true);
  jest.spyOn(SheetManager, 'show').mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());

it('says what stays free before it says what is new', async () => {
  await renderWithTheme(<WhatsNewScreen />);
  expect(screen.getByRole('header', {name: 'pro.whatsNewTitle'})).toBeTruthy();
  const lines = screen.getAllByText(/^pro\.whatsNew(Free|Pro|Where)$/).map(node => node.props['children'] as string);
  expect(lines).toEqual(['pro.whatsNewFree', 'pro.whatsNewPro', 'pro.whatsNewWhere']);
});

it('Done goes back and opens nothing', async () => {
  await renderWithTheme(<WhatsNewScreen />);
  await fireEvent.press(screen.getByRole('button', {name: 'pro.whatsNewDone'}));
  expect(navigationUtils.goBack).toHaveBeenCalledTimes(1);
  expect(SheetManager.show).not.toHaveBeenCalled();
});

it('"See zero Pro" goes back and opens the upgrade sheet', async () => {
  await renderWithTheme(<WhatsNewScreen />);
  await fireEvent.press(screen.getByRole('button', {name: 'pro.whatsNewSee'}));
  expect(navigationUtils.goBack).toHaveBeenCalledTimes(1);
  expect(SheetManager.show).toHaveBeenCalledWith('upgrade-sheet');
});
