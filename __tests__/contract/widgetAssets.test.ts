/**
 * The widgets' colours stay zero's colours (audit 2026-11-08 §6.3): every
 * role in contracts/widget-assets.json that names an app token (`app`) has
 * exactly the value ThemeContext gives that token, light and dark. Roles
 * without one are the widget's own (contrast at widget sizes, Material roles)
 * and are pinned by the generator's --check instead.
 */
import fs from 'node:fs';
import {fromRoot} from '../harness/paths';
import widgetAssets from '../../contracts/widget-assets.json';

type Mode = 'light' | 'dark';

/** The app's palette as ThemeContext declares it (the object literal, read as text). */
const appPalette = (mode: Mode): Record<string, string> => {
  const source = fs.readFileSync(fromRoot('src', 'ui', 'context', 'ThemeContext.tsx'), 'utf8');
  const name = mode === 'light' ? 'LightColors' : 'DarkColors';
  const body = new RegExp(`const ${name}: ThemeColors = \\{([\\s\\S]*?)\\n\\};`).exec(source)?.[1];
  if (!body) {
    throw new Error(`${name} not found in ThemeContext.tsx`);
  }
  return Object.fromEntries([...body.matchAll(/(\w+): '(#[0-9a-fA-F]{6})'/g)].map(([, key, value]) => [key, value]));
};

interface Role {
  light: string;
  dark: string;
  app?: Partial<Record<Mode, string>>;
}

const roles = Object.entries(widgetAssets.palette as Record<string, Role>);

it('reads the app palette (both modes, every token)', () => {
  expect(Object.keys(appPalette('light')).length).toBeGreaterThan(10);
  expect(Object.keys(appPalette('dark')).sort()).toEqual(Object.keys(appPalette('light')).sort());
});

it.each(
  roles.flatMap(([role, spec]) => (['light', 'dark'] as const).filter(m => spec.app?.[m]).map(m => [role, m] as const)),
)('%s (%s) equals its app token', (role, mode) => {
  const spec = widgetAssets.palette[role as keyof typeof widgetAssets.palette] as Role;
  const token = spec.app?.[mode] ?? '';
  expect(spec[mode].toUpperCase()).toBe(appPalette(mode)[token]?.toUpperCase());
});
