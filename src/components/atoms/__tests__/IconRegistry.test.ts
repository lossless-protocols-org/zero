/**
 * Characterization of the icon registry. Every key must map to the lucide
 * component it mapped to before the per-icon imports (S1, v2.7.1): lucide's
 * file names differ from its export names (`Home` lives in `house`), so the
 * snapshot of key → component displayName is what proves the rewrite kept
 * every mapping. CATEGORY_ICONS is the user-facing subset and must stay
 * fully resolvable.
 */
import {ICON_REGISTRY, isValidIconName} from '../IconRegistry';
import {CATEGORY_ICONS} from '../../../constants/categoryIcons';

// Node built-ins via require: the project's tsconfig loads jest's globals only, not @types/node.
const {existsSync} = require('fs');
const {join} = require('path');

declare const __dirname: string;

describe('ICON_REGISTRY', () => {
  const keys = Object.keys(ICON_REGISTRY);

  it('maps every key to the same lucide component as before (displayName snapshot)', () => {
    // Without --ci jest silently WRITES a missing snapshot and passes; the
    // recorded mapping is the point of this test, so its absence must fail.
    expect(existsSync(join(__dirname, '__snapshots__', 'IconRegistry.test.ts.snap'))).toBe(true);
    const displayNames: Record<string, string | undefined> = {};
    for (const key of keys) {
      displayNames[key] = ICON_REGISTRY[key as keyof typeof ICON_REGISTRY].displayName; // key comes from Object.keys of the same object
    }
    expect(displayNames).toMatchSnapshot();
  });

  it('every entry is a renderable component', () => {
    for (const key of keys) {
      const component: unknown = ICON_REGISTRY[key as keyof typeof ICON_REGISTRY]; // key comes from Object.keys of the same object
      // lucide icons are forwardRef objects; a `{default: Icon}` interop wrapper would have no $$typeof.
      expect(typeof component).toBe('object');
      expect(component !== null && typeof component === 'object' && '$$typeof' in component).toBe(true);
    }
  });

  it('CATEGORY_ICONS are all registry keys, with no duplicates', () => {
    for (const name of CATEGORY_ICONS) {
      expect(isValidIconName(name)).toBe(true);
    }
    expect(new Set(CATEGORY_ICONS).size).toBe(CATEGORY_ICONS.length);
  });

  it('keeps the registry size (335 keys over 327 lucide files)', () => {
    expect(keys).toHaveLength(335);
  });
});
