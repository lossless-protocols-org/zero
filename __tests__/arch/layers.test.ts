/**
 * One dependency rule for src/ (M9, v2.7.1), declared in
 * .dependency-cruiser.cjs and enforced on every test run: src/ is clean, and a
 * tree that breaks every rule once reports each break, so a rule that stops
 * firing (a typo in a path, a tool upgrade) fails here instead of going quiet.
 */
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fromRoot, REPO_ROOT} from '../harness/paths';

interface Violation {
  from: string;
  to: string;
  rule: {name: string};
  cycle?: Array<{name: string}>;
}

/** dependency-cruiser's verdict on `src/` under `cwd`. */
const cruise = (cwd: string): Violation[] => {
  const run = spawnSync(
    fromRoot('node_modules', '.bin', 'depcruise'),
    ['src', '--config', fromRoot('.dependency-cruiser.cjs'), '--output-type', 'json'],
    {cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024},
  );
  if (!run.stdout) {
    throw new Error(`depcruise produced no report: ${run.stderr}`);
  }
  // dependency-cruiser's JSON reporter; only the summary is read.
  const report = JSON.parse(run.stdout) as {summary: {violations: Violation[]}};
  return report.summary.violations;
};

it('src/ has no layer violations and no import cycles', () => {
  const found = cruise(REPO_ROOT).map(v => `${v.rule.name}: ${v.from} → ${v.to}`);
  expect(found).toEqual([]);
});

describe('the rules themselves', () => {
  const FIXTURE: Record<string, string> = {
    'src/domain/usesReact.ts': "import {useState} from 'react';\nexport const a = useState;",
    'src/domain/usesPlatform.ts': "import {p} from '../platform/p';\nexport const b = p;",
    // A type-only import is exempt from the layer rules (platform may name a store type)…
    'src/platform/typeOnly.ts': "import type {S} from '../store/s';\nexport type T = S;",
    // …except from the layers that own rows, which may not even name a type from above (L1).
    'src/data/reexported.ts': "import type {S} from '../store/s';\nexport type R = S;",
    'src/domain/cycleA.ts': "import {c2} from './cycleB';\nexport const c1 = () => c2;",
    'src/domain/cycleB.ts': "import {c1} from './cycleA';\nexport const c2 = () => c1;",
    'src/platform/p.ts': "import i18n from 'i18next';\nexport const p = i18n;",
    'src/store/s.ts': 'export const s = 1;\nexport type S = number;',
    'src/data/d.ts': "import {spec} from '../native/spec';\nexport const d = spec;",
    'src/native/spec.ts': 'export const spec = 1;',
    'src/ui/atoms/ReadsStore.tsx': "import {s} from '../../store/s';\nexport const A = s;",
    'src/stray/x.ts': "import {s} from '../store/s';\nexport const x = s;",
    'src/features/one/lib.ts': 'export const lib = 1;',
    'src/features/one/hooks/useUp.ts': "import {S} from '../screens/S';\nexport const useUp = S;",
    'src/features/one/components/ReadsData.tsx': "import {d} from '../../../data/d';\nexport const C = d;",
    'src/features/one/screens/S.tsx':
      "import {lib} from '../lib';\nimport {two} from '../../two/lib';\nimport type {Two} from '../../two/types';\nexport const S = [lib, two];\nexport type T = Two;",
    'src/features/two/lib.ts': 'export const two = 2;',
    'src/features/two/types.ts': 'export type Two = number;',
    'src/features/widgets/bridge.ts': "import {spec} from '../../native/spec';\nexport const bridge = spec;",
    // The 3.0 laws: L1 (not even a type), src/pro decides only, L8 (Pro features behind ProStack).
    'src/pro/entitlement.ts': "import {useState} from 'react';\nexport const e = useState;\nexport type E = number;",
    // The store's gateway may import its spec, like the widget bridge above.
    'src/pro/billing.ts': "import {spec} from '../native/spec';\nexport const billing = spec;",
    'src/data/tierAware.ts': "import type {E} from '../pro/entitlement';\nexport type T = E;",
    'src/features/accounts/screens/A.tsx': 'export const A = 1;',
    'src/navigation/Home.tsx': "import {A} from '../features/accounts/screens/A';\nexport const H = A;",
    'src/navigation/ProStack.tsx': "import {A} from '../features/accounts/screens/A';\nexport const P = A;",
    'src/domain/freeTier.ts': 'export const FREE = 1;',
    'src/data/limits.ts': "import {FREE} from '../domain/freeTier';\nexport const limit = FREE;",
    // The import planner's 2.8 debt was cleared in 3.0 (P7): it may no longer read the limit.
    'src/data/backup/import/planner.ts': "import {FREE} from '../../../domain/freeTier';\nexport const merge = FREE;",
    // Its last debt was cleared in P9: the category service may no longer read the limit either.
    'src/data/services/categoryService.ts': "import {FREE} from '../../domain/freeTier';\nexport const cap = FREE;",
    'src/domain/reexportsLimit.ts': "export {FREE} from './freeTier';",
    'src/navigation/HomeStack.tsx': "import {P} from './ProStack';\nexport const Root = P;",
    'src/navigation/Other.tsx': "import {P} from './ProStack';\nexport const O = P;",
    'tsconfig.json': JSON.stringify({compilerOptions: {strict: true, jsx: 'react-jsx'}}),
  };

  it('reports every broken rule, once, and leaves the allowed edges alone', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'layers-'));
    try {
      for (const [file, text] of Object.entries(FIXTURE)) {
        fs.mkdirSync(path.dirname(path.join(dir, file)), {recursive: true});
        fs.writeFileSync(path.join(dir, file), text);
      }
      // Packages resolve as they do for src/ (the package rules match resolved paths).
      fs.symlinkSync(fromRoot('node_modules'), path.join(dir, 'node_modules'));
      // A package by its name, not the file its manifest happens to point at.
      const packageOf = (to: string) => to.replace(/^node_modules\/((?:@[^/]+\/)?[^/]+)\/.*$/, '$1');
      const found = cruise(dir)
        .map(v => `${v.rule.name}: ${v.from} → ${packageOf(v.to)}`)
        .sort();
      expect(found).toEqual([
        'components-through-hooks: src/features/one/components/ReadsData.tsx → src/data/d.ts',
        'components-through-hooks: src/ui/atoms/ReadsStore.tsx → src/store/s.ts',
        'domain-pure: src/domain/usesReact.ts → react',
        'feature-order-hooks: src/features/one/hooks/useUp.ts → src/features/one/screens/S.tsx',
        'free-limits-not-in-data: src/data/backup/import/planner.ts → src/domain/freeTier.ts',
        'free-limits-not-in-data: src/data/limits.ts → src/domain/freeTier.ts',
        'free-limits-not-in-data: src/data/services/categoryService.ts → src/domain/freeTier.ts',
        'free-limits-not-in-data: src/domain/reexportsLimit.ts → src/domain/freeTier.ts',
        'layer-domain: src/domain/usesPlatform.ts → src/platform/p.ts',
        'native-gateway: src/data/d.ts → src/native/spec.ts',
        'no-circular: src/domain/cycleA.ts → src/domain/cycleB.ts',
        'no-cross-feature: src/features/one/screens/S.tsx → src/features/two/lib.ts',
        'outside-every-layer: src/stray/x.ts → src/store/s.ts',
        'platform-no-react: src/platform/p.ts → i18next',
        'pro-decides-only: src/pro/entitlement.ts → react',
        'pro-features-behind-pro-stack: src/navigation/Home.tsx → src/features/accounts/screens/A.tsx',
        'pro-stack-single-mount: src/navigation/Other.tsx → src/navigation/ProStack.tsx',
        'tier-blind-data: src/data/reexported.ts → src/store/s.ts',
        'tier-blind-data: src/data/tierAware.ts → src/pro/entitlement.ts',
      ]);
    } finally {
      fs.rmSync(dir, {recursive: true, force: true});
    }
  });
});
