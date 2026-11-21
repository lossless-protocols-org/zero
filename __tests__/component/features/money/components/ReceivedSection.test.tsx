/**
 * Money in on the Money tab (3.0): with Pro each row is drawn under its own
 * category; without Pro every row is drawn under the one Free shows, with no
 * category name on it. A row with no note is still named after its own
 * category in both tiers: what it was is the user's own word.
 */
import React from 'react';
import {screen} from '@testing-library/react-native';
import {ReceivedSection} from '../../../../../src/features/money/components/ReceivedSection';
import type {CategoryData, IncomeData} from '../../../../../src/domain/types';
import {setMockTranslations} from '../../../../harness/mocks/reactI18next';
import {renderInApp, themeColors} from '../../../../harness/render';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));

const category = (id: string, name: string, icon: string): CategoryData => ({
  id,
  name,
  kind: 'income',
  categoryStatus: true,
  userId: 'u1',
  icon,
  color: '#3D9960',
  sortOrder: 10,
});
const salary = category('salary', 'Salary', 'coins');
const freelance = category('freelance', 'Freelance', 'briefcase');
const income = (id: string, categoryId: string, note: string): IncomeData => ({
  id,
  userId: 'u1',
  categoryId,
  accountId: 'acct_u1',
  amount: 100,
  date: '2026-11-05',
  note,
  createdAt: 1,
  updatedAt: 1,
});

const draw = async (oneCategory: CategoryData | null, categories: CategoryData[] = [salary, freelance]) => {
  setMockTranslations({'money.rowLabel': '{{title}}, {{amount}}, {{date}}'});
  await renderInApp(
    <ReceivedSection
      colors={await themeColors()}
      monthLabel="November 2026"
      canGoForward={false}
      onShiftMonth={() => {}}
      onOpenMonthPicker={() => {}}
      incomes={[income('a', 'freelance', 'logo'), income('b', 'freelance', '')]}
      categories={categories}
      oneCategory={oneCategory}
      received={200}
      kept={null}
      copyFromMonth={null}
      onCopyLastMonth={() => {}}
      onOpen={() => {}}
    />,
  );
};
const subtitles = () => screen.queryAllByText(/·|Nov|5/).map(node => node.props['children'] as string);

it('with Pro and one category, a row with a note names its category beside the day', async () => {
  await draw(null, [freelance]);
  expect(screen.getByText('logo')).toBeTruthy();
  expect(subtitles().some(text => text.startsWith('Freelance · '))).toBe(true);
});

it('with Pro and several categories, the month reads by category with each total, and rows do not repeat it', async () => {
  await draw(null);
  // One header for Freelance (Salary has no rows this month, so no header), and the untitled row.
  expect(screen.getAllByText('Freelance')).toHaveLength(2);
  expect(screen.getByRole('header')).toBeTruthy();
  expect(screen.queryByText('Salary')).toBeNull();
  expect(subtitles().some(text => text.includes('·'))).toBe(false);
});

it('without Pro, no row names a category beside the day', async () => {
  await draw(salary);
  expect(screen.getByText('logo')).toBeTruthy();
  expect(subtitles().some(text => text.includes('·'))).toBe(false);
});

it('in both tiers a row with no note is titled after its own category', async () => {
  for (const one of [null, salary]) {
    await draw(one, [freelance]);
    expect(screen.getByText('Freelance')).toBeTruthy();
    await screen.unmount();
  }
});
