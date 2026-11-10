/**
 * The first start after a schema change migrates the database before the
 * first frame; on a large database that held a blank screen for a second or
 * more. An existing user now sees "Updating your data…" until the start ends,
 * then Home with their rows; the version is recorded, so the next start goes
 * straight in (audit 2026-11-08 §8.4). A new install never sees it.
 *
 * Its own file: the recorded version and the once-per-runtime start live in
 * module state, which every test file gets fresh. The navigator is a stand-in
 * that reports what the store holds when it first draws: the screens are not
 * the subject, and Home's gesture rows need more than jest's animation mocks.
 */
import React from 'react';
import {render, screen} from '@testing-library/react-native';
import App from '../../App';
import {isOnboardedPreference} from '../../src/platform/onboarding';
import {StorageService} from '../../src/platform/storage';
import {formatDate} from '../../src/domain/dates';
import {schema} from '../../src/data/database/schema';
import * as services from '../harness/services';
import {store} from '../../src/store/store';
import {selectExpenseData} from '../../src/store/slices/expenseDataSlice';

/** What the store held for this month when the app's screens first drew. */
const mockFirstDraw: {titles: string[] | null} = {titles: null};
jest.mock('../../src/navigation/MainStack', () => {
  const {Text} = jest.requireActual<typeof import('react-native')>('react-native');
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const {store: liveStore} = jest.requireActual<typeof import('../../src/store/store')>('../../src/store/store');
  const slice = jest.requireActual<typeof import('../../src/store/slices/expenseDataSlice')>(
    '../../src/store/slices/expenseDataSlice',
  );
  const dates = jest.requireActual<typeof import('../../src/domain/dates')>('../../src/domain/dates');
  return {
    MainStack: () => {
      mockFirstDraw.titles ??= slice
        .selectExpenseData(liveStore.getState(), dates.formatDate(new Date(), 'YYYY-MM'))
        .map(e => e.title);
      return ReactActual.createElement(Text, null, 'screens');
    },
  };
});

// Frames advance as in real time; the gesture/animation mocks' leftover frames are dropped at the end, not run into teardown.
beforeEach(() => jest.useFakeTimers({advanceTimers: true}));
afterEach(() => jest.useRealTimers());

it('an existing user sees "Updating your data…", then the screens, which draw with the month loaded', async () => {
  const userId = await services.createUser('Ravi', '');
  await services.createCurrency('INR', '₹', 'Indian Rupee', userId);
  const food = await services.createCategory('Food', userId, null, null, 'expense');
  await services.createExpense(userId, 'Chai', 20, '', food, `${formatDate(new Date())}T08:00:00`);
  isOnboardedPreference.set(true);
  expect(StorageService.getItemSync('database_schema_version')).toBeNull(); // as on 2.7.1

  await render(<App />);
  expect(screen.getByText('Updating your data…')).toBeOnTheScreen();
  expect(await screen.findByText('screens')).toBeOnTheScreen();
  expect(screen.queryByText('Updating your data…')).toBeNull();
  // Home's first draw already has the month: no empty frame, no second commit for it.
  expect(mockFirstDraw.titles).toEqual(['Chai']);
  expect(selectExpenseData(store.getState(), formatDate(new Date(), 'YYYY-MM')).map(e => e.title)).toEqual(['Chai']);
  expect(StorageService.getItemSync('database_schema_version')).toBe(String(schema.version));
});
