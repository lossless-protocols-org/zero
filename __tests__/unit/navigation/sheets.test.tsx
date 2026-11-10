/**
 * Each action sheet is registered as a function that draws its component, so
 * its module loads when it first opens rather than at startup (audit
 * 2026-11-08 §8.3). The indirection is where an id could be wired to the
 * wrong sheet: each id must draw its own component, and every id must be
 * registered once.
 */
import fs from 'node:fs';
import type React from 'react';
import {fromRoot} from '../../harness/paths';
import {registerSheet} from 'react-native-actions-sheet';
import {IconPickerSheet} from '../../../src/features/categories/sheets/IconPickerSheet';
import {ColorPickerSheet} from '../../../src/features/categories/sheets/ColorPickerSheet';
import {DatePickerSheet} from '../../../src/ui/sheets/DatePickerSheet';
import {CurrencyPickerSheet} from '../../../src/features/settings/sheets/CurrencyPickerSheet';
import {ChangeNameSheet} from '../../../src/ui/sheets/ChangeNameSheet';
import {MonthYearPickerSheet} from '../../../src/ui/sheets/MonthYearPickerSheet';
import {ThemePickerSheet} from '../../../src/features/settings/sheets/ThemePickerSheet';
import {WeekStartPickerSheet} from '../../../src/features/settings/sheets/WeekStartPickerSheet';
import {LanguagePickerSheet} from '../../../src/features/settings/sheets/LanguagePickerSheet';
import {BudgetSheet} from '../../../src/ui/sheets/BudgetSheet';
import {RowActionsSheet} from '../../../src/ui/sheets/RowActionsSheet';
import {ListSortSheet} from '../../../src/features/spending/sheets/ListSortSheet';
import '../../../src/navigation/sheets'; // registers, through the mock below (jest hoists it above the imports)

jest.mock('react-native-actions-sheet', () => ({
  ...jest.requireActual('react-native-actions-sheet'),
  registerSheet: jest.fn(),
}));

/** What sheets.tsx registered: [id, draw] per call. */
const registered = (): Array<[string, (props: object) => React.ReactElement]> =>
  jest.mocked(registerSheet).mock.calls.map(([id, draw]) => [
    String(id),
    draw as (props: object) => React.ReactElement, // sheets.tsx registers a function component for every id
  ]);

const EXPECTED: Record<string, unknown> = {
  'icon-picker-sheet': IconPickerSheet,
  'color-picker-sheet': ColorPickerSheet,
  'date-picker-sheet': DatePickerSheet,
  'currency-picker-sheet': CurrencyPickerSheet,
  'change-name-sheet': ChangeNameSheet,
  'month-year-picker-sheet': MonthYearPickerSheet,
  'theme-picker-sheet': ThemePickerSheet,
  'week-start-picker-sheet': WeekStartPickerSheet,
  'language-picker-sheet': LanguagePickerSheet,
  'budget-sheet': BudgetSheet,
  'row-actions-sheet': RowActionsSheet,
  'list-sort-sheet': ListSortSheet,
};

it('loads the sheet machinery at startup, which release builds need before the first sheet opens', () => {
  const source = fs.readFileSync(fromRoot('src', 'navigation', 'sheets.tsx'), 'utf8');
  expect(source).toMatch(/^import '\.\.\/ui\/atoms\/CustomBottomSheet';$/m);
});

it('registers every sheet once', () => {
  expect(
    registered()
      .map(([id]) => id)
      .sort(),
  ).toEqual(Object.keys(EXPECTED).sort());
});

it.each(Object.keys(EXPECTED))('%s draws its own component with the props it is given', id => {
  const draw = registered().find(([sheetId]) => sheetId === id)?.[1];
  const props = {sheetId: id, payload: {marker: id}};
  const element = draw?.(props);
  expect(element?.type).toBe(EXPECTED[id]);
  expect(element?.props).toEqual(props);
});
