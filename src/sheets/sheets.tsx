import type {ThemeMode} from '../context/ThemeContext';
import {registerSheet, SheetDefinition} from 'react-native-actions-sheet';
import IconPickerSheet from './IconPickerSheet';
import ColorPickerSheet from './ColorPickerSheet';
import DatePickerSheet from './DatePickerSheet';
import CurrencyPickerSheet from './CurrencyPickerSheet';
import ChangeNameSheet from './ChangeNameSheet';
import MonthYearPickerSheet from './MonthYearPickerSheet';
import ThemePickerSheet from './ThemePickerSheet';
import WeekStartPickerSheet from './WeekStartPickerSheet';
import LanguagePickerSheet from './LanguagePickerSheet';
import BudgetSheet from './BudgetSheet';
import type {BudgetScopeList} from '../utils/budgetScopes';
import RowActionsSheet from './RowActionsSheet';

registerSheet('icon-picker-sheet', IconPickerSheet);
registerSheet('color-picker-sheet', ColorPickerSheet);
registerSheet('date-picker-sheet', DatePickerSheet);
registerSheet('currency-picker-sheet', CurrencyPickerSheet);
registerSheet('change-name-sheet', ChangeNameSheet);
registerSheet('month-year-picker-sheet', MonthYearPickerSheet);
registerSheet('theme-picker-sheet', ThemePickerSheet);
registerSheet('week-start-picker-sheet', WeekStartPickerSheet);
registerSheet('language-picker-sheet', LanguagePickerSheet);
registerSheet('budget-sheet', BudgetSheet);
registerSheet('row-actions-sheet', RowActionsSheet);

declare module 'react-native-actions-sheet' {
  interface Sheets {
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
      };
    }>;
  }
}
