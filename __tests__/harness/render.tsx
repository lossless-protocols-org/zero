import React from 'react';
import {render, renderHook} from '@testing-library/react-native';
import {Provider} from 'react-redux';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {store} from '../../src/store/store';
import {ThemeProvider, useThemeColors, type ThemeColors} from '../../src/ui/context/ThemeContext';
import {DialogProvider} from '../../src/ui/context/DialogContext';
import {DialogView} from '../../src/ui/molecules/DialogView';

/**
 * Render inside the app's real providers, so a component reads the real
 * palette and dialogs: no per-suite colour stubs that drift from ThemeContext
 * (audit 2026-11-08 §7.5).
 *
 * - `renderWithTheme`: ThemeProvider only (atoms and molecules);
 * - `themeColors`: the real palette, for components that take `colors` as a prop;
 * - `renderHookInApp` / `renderInApp`: the real store, theme and dialogs, as
 *   App mounts them (hooks and components that read the store and talk to the
 *   user). Pair them with the LokiJS database jest.setup.js installs, and seed
 *   through the services.
 */
const WithTheme = ({children}: {children: React.ReactNode}) => <ThemeProvider>{children}</ThemeProvider>;

const InApp = ({children}: {children: React.ReactNode}) => (
  <GestureHandlerRootView>
    <Provider store={store}>
      <ThemeProvider>
        <DialogProvider DialogView={DialogView}>{children}</DialogProvider>
      </ThemeProvider>
    </Provider>
  </GestureHandlerRootView>
);

export const renderWithTheme = (ui: React.ReactElement) => render(ui, {wrapper: WithTheme});

export const renderInApp = (ui: React.ReactElement) => render(ui, {wrapper: InApp});

export const renderHookInApp = <Result,>(hook: () => Result) => renderHook(hook, {wrapper: InApp});

export const themeColors = async (): Promise<ThemeColors> =>
  (await renderHook(() => useThemeColors(), {wrapper: WithTheme})).result.current;
