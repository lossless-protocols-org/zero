import type {ThemeMode} from '../ui/context/ThemeContext';
import React from 'react';
import {registerSheet, type SheetDefinition, type SheetProps} from 'react-native-actions-sheet';
import {IconPickerSheet} from '../features/categories/sheets/IconPickerSheet';
import {ColorPickerSheet} from '../features/categories/sheets/ColorPickerSheet';
import {DatePickerSheet} from '../ui/sheets/DatePickerSheet';
import {CurrencyPickerSheet} from '../features/settings/sheets/CurrencyPickerSheet';
import {ChangeNameSheet} from '../ui/sheets/ChangeNameSheet';
import {MonthYearPickerSheet} from '../ui/sheets/MonthYearPickerSheet';
import {ThemePickerSheet} from '../features/settings/sheets/ThemePickerSheet';
import {WeekStartPickerSheet} from '../features/settings/sheets/WeekStartPickerSheet';
import {LanguagePickerSheet} from '../features/settings/sheets/LanguagePickerSheet';
import {BudgetSheet} from '../ui/sheets/BudgetSheet';
import type {BudgetScopeList} from '../domain/budgetScopes';
import {RowActionsSheet} from '../ui/sheets/RowActionsSheet';
import {ListSortSheet} from '../features/spending/sheets/ListSortSheet';
import type {RowExtraAction} from '../ui/hooks/useRowActions';
// Loaded at startup on purpose, and it must stay: see below.
import '../ui/atoms/CustomBottomSheet';

/**
 * Each sheet is registered as a function that names its component in its
 * body. With Metro's inline requires, a sheet's module (and everything it
 * imports: the icon grid, the currency list, the date picker) then loads the
 * first time it opens. Registering the components themselves evaluated all
 * twelve at startup (audit 2026-11-08 §8.3).
 *
 * The sheet machinery itself is NOT lazy: CustomBottomSheet, and through it
 * react-native-actions-sheet's ActionSheet view, load at startup through the
 * side-effect import above. When the first sheet to open was also the first
 * evaluation of that view (every sheet lazy, nothing else importing it),
 * release builds mounted the sheet and never showed it, and the invisible
 * sheet then swallowed taps (found on the emulator, 2026-11-09; jest cannot
 * reproduce it). `__tests__/unit/navigation/sheets.test.tsx` pins the import.
 */
registerSheet('icon-picker-sheet', (props: SheetProps<'icon-picker-sheet'>) => <IconPickerSheet {...props} />);
registerSheet('color-picker-sheet', (props: SheetProps<'color-picker-sheet'>) => <ColorPickerSheet {...props} />);
registerSheet('date-picker-sheet', (props: SheetProps<'date-picker-sheet'>) => <DatePickerSheet {...props} />);
registerSheet('currency-picker-sheet', (props: SheetProps<'currency-picker-sheet'>) => (
  <CurrencyPickerSheet {...props} />
));
registerSheet('change-name-sheet', (props: SheetProps<'change-name-sheet'>) => <ChangeNameSheet {...props} />);
registerSheet('month-year-picker-sheet', (props: SheetProps<'month-year-picker-sheet'>) => (
  <MonthYearPickerSheet {...props} />
));
registerSheet('theme-picker-sheet', (props: SheetProps<'theme-picker-sheet'>) => <ThemePickerSheet {...props} />);
registerSheet('week-start-picker-sheet', (props: SheetProps<'week-start-picker-sheet'>) => (
  <WeekStartPickerSheet {...props} />
));
registerSheet('language-picker-sheet', (props: SheetProps<'language-picker-sheet'>) => (
  <LanguagePickerSheet {...props} />
));
registerSheet('budget-sheet', (props: SheetProps<'budget-sheet'>) => <BudgetSheet {...props} />);
registerSheet('row-actions-sheet', (props: SheetProps<'row-actions-sheet'>) => <RowActionsSheet {...props} />);
registerSheet('list-sort-sheet', (props: SheetProps<'list-sort-sheet'>) => <ListSortSheet {...props} />);

declare module 'react-native-actions-sheet' {
  interface Sheets {
    'list-sort-sheet': SheetDefinition;
    'icon-picker-sheet': SheetDefinition<{
      payload: {
        selectedIcon?: string;
        onSelect?: (icon: string) => void;
      };
    }>;
    'color-picker-sheet': SheetDefinition<{
      payload: {
        selectedColor?: string;
        onSelect?: (color: string) => void;
      };
    }>;
    'date-picker-sheet': SheetDefinition<{
      payload: {
        selectedDate?: string;
        minDate?: Date;
        maxDate?: Date;
        onSelect?: (date: Date) => void;
      };
    }>;
    'currency-picker-sheet': SheetDefinition<{
      payload: {
        selectedCurrency?: {code: string; name: string; symbol: string};
        onSelect?: (currency: {code: string; name: string; symbol: string}) => void;
      };
    }>;
    'change-name-sheet': SheetDefinition<{
      payload: {
        currentName?: string;
        onUpdate?: (name: string) => void;
      };
    }>;
    'month-year-picker-sheet': SheetDefinition<{
      payload: {
        selectedMonth?: number;
        selectedYear?: number;
        availableYears?: number[];
        onSelect?: (monthIndex: number, year: number) => void;
      };
    }>;
    'theme-picker-sheet': SheetDefinition<{
      payload: {
        currentTheme?: ThemeMode;
        onSelect?: (theme: ThemeMode) => void;
      };
    }>;
    'week-start-picker-sheet': SheetDefinition<{
      payload: {
        current?: 'sunday' | 'monday';
        onSelect?: (day: 'sunday' | 'monday') => void;
      };
    }>;
    'language-picker-sheet': SheetDefinition<{
      payload: {
        currentLanguage?: string;
        onSelect?: (language: string) => void;
      };
    }>;
    'budget-sheet': SheetDefinition<{
      payload: {
        currencySymbol?: string;
        currencyCode?: string;
        monthLabel?: string;
        /** Overall first (categoryId ''), then one entry per active category. */
        scopes?: BudgetScopeList;
        initialCategoryId?: string;
        onSave?: (amount: number, everyMonth: boolean, categoryId?: string) => void;
        onRemove?: (isRecurring: boolean, categoryId?: string) => void;
      };
    }>;
    'row-actions-sheet': SheetDefinition<{
      payload: {
        title?: string;
        editLabel?: string;
        deleteLabel?: string;
        onEdit?: () => void;
        onDelete?: () => void;
        extraActions?: readonly RowExtraAction[];
      };
    }>;
  }
}
