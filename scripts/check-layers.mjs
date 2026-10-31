#!/usr/bin/env node
/**
 * Enforces the one dependency rule for src/ (M9, v2.7.1):
 *
 *   domain, constants, styles → utils (pure) → i18n → data (watermelondb, backend)
 *     → redux → hooks, context → atoms → molecules → sheets → screens → navigation
 *
 * A module may import from its own layer or a lower one. On top of that:
 *   - utils stay pure: no React, no i18next, no src/i18n;
 *   - components reach Redux and the database only through hooks/context.
 * Any import cycle inside src/ also fails. Type-only imports (`import type`,
 * `typeof import()`) are skipped: the compiler erases them, so they create no
 * runtime edge, init-order cycle or bundle coupling.
 *
 * Node only, no dependencies (dependency-cruiser would be a new dev
 * dependency). Usage: node scripts/check-layers.mjs [--verbose]
 * Exits 1 when anything is found.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');

const LAYERS = [
  ['domain', 0],
  ['constants', 0],
  ['styles', 0],
  ['utils', 1],
  ['i18n', 2],
  ['watermelondb', 3],
  ['backend', 3],
  ['redux', 4],
  ['hooks', 5],
  ['context', 5],
  ['components/atoms', 6],
  ['components/molecules', 7],
  ['sheets', 8],
  ['screens', 9],
  ['navigation', 10],
];
const IGNORED = ['testing'];
const PURE_UTILS_FORBIDDEN_PACKAGES = new Set(['react', 'i18next', 'react-i18next']);
const COMPONENTS_FORBIDDEN_DIRS = ['redux', 'watermelondb', 'backend'];
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

const relToSrc = file => path.relative(src, file).split(path.sep).join('/');

const layerOf = file => {
  const rel = relToSrc(file);
  let best;
  for (const [dir, rank] of LAYERS) {
    if (rel === dir || rel.startsWith(`${dir}/`)) {
      if (!best || dir.length > best.dir.length) {
        best = {dir, rank};
      }
    }
  }
  return best;
};

const isTest = rel => /(^|\/)__tests__\//.test(rel) || /\.test\.tsx?$/.test(rel);

const listSources = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listSources(full, out);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
};

// Comments first, so a commented-out import does not count.
const stripComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const STATEMENTS = [
  // import X from 'a' · import {a, type B} from 'a' · import type {A} from 'a'
  {
    pattern: /\bimport\s+(type\s+)?([^'"`;]*?)\s+from\s+['"]([^'"]+)['"]/g,
    spec: 3,
    typeOnly: m => !!m[1] || allTypeSpecifiers(m[2]),
  },
  // import 'a' (side effect)
  {pattern: /\bimport\s+['"]([^'"]+)['"]/g, spec: 1, typeOnly: () => false},
  // export {a} from 'a' · export * from 'a' · export * as ns from 'a' · export type {A} from 'a'
  {
    pattern: /\bexport\s+(type\s+)?(\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/g,
    spec: 3,
    typeOnly: m => !!m[1] || allTypeSpecifiers(m[2]),
  },
  {pattern: /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g, spec: 1, typeOnly: () => false},
  // import('a') at runtime, or `typeof import('a')` in a type position
  {pattern: /(\btypeof\s+)?\bimport\(\s*['"]([^'"]+)['"]\s*\)/g, spec: 2, typeOnly: m => !!m[1]},
];

/** `{type A, type B}`: every named specifier is a type, so the import is erased. */
function allTypeSpecifiers(clause) {
  const braces = /^\{([\s\S]*)\}$/.exec(clause.trim());
  if (!braces) {
    return false;
  }
  const names = braces[1]
    .split(',')
    .map(n => n.trim())
    .filter(Boolean);
  return names.length > 0 && names.every(n => n.startsWith('type '));
}

/** Runtime specifiers of a file; a specifier imported both ways counts as runtime. */
const specifiersOf = text => {
  const body = stripComments(text);
  const runtime = new Set();
  for (const {pattern, spec, typeOnly} of STATEMENTS) {
    for (const match of body.matchAll(pattern)) {
      if (!typeOnly(match)) {
        runtime.add(match[spec]);
      }
    }
  }
  return [...runtime];
};

const resolveRelative = (fromFile, spec) => {
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [base, ...EXTENSIONS.map(e => base + e), ...EXTENSIONS.map(e => path.join(base, `index${e}`))];
  return candidates.find(c => fs.existsSync(c) && fs.statSync(c).isFile());
};

const packageName = spec => (spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]);

export const checkLayers = () => {
  const files = listSources(src).filter(
    f => !isTest(relToSrc(f)) && !IGNORED.some(d => relToSrc(f).startsWith(`${d}/`)),
  );
  const graph = new Map();
  const violations = [];

  for (const file of files) {
    const from = layerOf(file);
    const edges = [];
    for (const spec of specifiersOf(fs.readFileSync(file, 'utf8'))) {
      if (!spec.startsWith('.')) {
        if (from?.dir === 'utils' && PURE_UTILS_FORBIDDEN_PACKAGES.has(packageName(spec))) {
          violations.push(`${relToSrc(file)} → ${spec} (utils must stay pure)`);
        }
        continue;
      }
      const target = resolveRelative(file, spec);
      if (!target || !target.startsWith(src + path.sep)) {
        continue; // assets, App.tsx, files outside src
      }
      const rel = relToSrc(target);
      if (IGNORED.some(d => rel.startsWith(`${d}/`))) {
        continue;
      }
      edges.push(target);
      const to = layerOf(target);
      if (!from || !to) {
        violations.push(`${relToSrc(file)} → ${rel} (outside every layer)`);
      } else if (to.rank > from.rank) {
        violations.push(`${relToSrc(file)} → ${rel} (${from.dir} may not import ${to.dir})`);
      } else if (from.dir.startsWith('components/') && COMPONENTS_FORBIDDEN_DIRS.includes(to.dir)) {
        violations.push(`${relToSrc(file)} → ${rel} (components reach ${to.dir} through hooks/context)`);
      } else if (from.dir === 'utils' && to.dir === 'i18n') {
        violations.push(`${relToSrc(file)} → ${rel} (utils must stay pure)`);
      }
    }
    graph.set(file, edges);
  }

  // Cycles: iterative DFS, each cycle reported once by its sorted member list.
  const cycles = new Map();
  const state = new Map(); // 1 = on stack, 2 = done
  for (const start of graph.keys()) {
    if (state.get(start)) continue;
    const stack = [[start, 0]];
    const pathStack = [start];
    state.set(start, 1);
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      const [node, index] = top;
      const edges = graph.get(node) ?? [];
      if (index >= edges.length) {
        state.set(node, 2);
        stack.pop();
        pathStack.pop();
        continue;
      }
      top[1] = index + 1;
      const next = edges[index];
      if (state.get(next) === 1) {
        const loop = pathStack.slice(pathStack.indexOf(next)).map(relToSrc);
        cycles.set([...loop].sort().join(' | '), [...loop, relToSrc(next)].join(' → '));
      } else if (!state.get(next)) {
        state.set(next, 1);
        stack.push([next, 0]);
        pathStack.push(next);
      }
    }
  }

  return {files: files.length, violations: [...new Set(violations)].sort(), cycles: [...cycles.values()].sort()};
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const {files, violations, cycles} = checkLayers();
  for (const v of violations) console.log(`violation  ${v}`);
  for (const c of cycles) console.log(`cycle      ${c}`);
  console.log(`check-layers: ${files} files, ${violations.length} violations, ${cycles.length} cycles`);
  process.exit(violations.length + cycles.length > 0 ? 1 : 0);
}
