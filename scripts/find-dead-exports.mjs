#!/usr/bin/env node
/**
 * Lists exports nothing else uses (M14, v2.7.1). An export counts as used when
 * its name appears in another source file that is not merely re-exporting it
 * (barrels such as services/index.ts do not count). Names used only by tests
 * are reported as test-only unless the export carries `@internal test`.
 *
 * A word match, not a type checker: a name that also appears unrelated
 * elsewhere reads as used. Good enough to measure; it never deletes anything.
 * Usage: node scripts/find-dead-exports.mjs   (exits 1 when anything is found)
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = file => path.relative(root, file).split(path.sep).join('/');

const listSources = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') listSources(full, out);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
};

// src/testing holds jest mocks and helpers: a name used there is test use, not product use.
const isTest = file =>
  rel(file).startsWith('src/testing/') || /(^|\/)__tests__\//.test(rel(file)) || /\.test\.tsx?$/.test(file);
const isBarrel = text =>
  /^\s*export\s+(\*|\{[^}]*\})\s+from\s+/m.test(text) &&
  !/^\s*export\s+(const|function|class|interface|type\s+\w+\s*=)/m.test(text);

// src/testing holds jest module mocks: their exports mirror the mocked library's API.
const sources = listSources(path.join(root, 'src')).filter(f => !rel(f).startsWith('src/testing/'));
const others = [
  path.join(root, 'App.tsx'),
  path.join(root, 'index.js'),
  ...listSources(path.join(root, '__tests__')),
].filter(f => fs.existsSync(f));
const all = [...sources, ...others, ...listSources(path.join(root, 'src/testing'))];
// Comments first, so a name merely mentioned in prose does not count as a use.
const stripComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const raw = new Map(all.map(f => [f, fs.readFileSync(f, 'utf8')]));
const texts = new Map([...raw].map(([f, text]) => [f, stripComments(text)]));

const DECLARED =
  /^export\s+(?:declare\s+)?(?:async\s+)?(?:const|let|function\*?|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm;
const LISTED = /^export\s+(?:type\s+)?\{([^}]*)\}\s*;?\s*$/gm;

const findings = [];
for (const file of sources) {
  if (isTest(file)) continue;
  // The declaring file keeps its comments: `@internal test` lives in one.
  const text = raw.get(file);
  if (isBarrel(text)) continue;
  const names = new Set();
  for (const m of text.matchAll(DECLARED)) names.add(m[1]);
  for (const m of text.matchAll(LISTED)) {
    for (const part of m[1].split(',')) {
      const name = part
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)
        .pop();
      if (name) names.add(name);
    }
  }
  for (const name of names) {
    const word = new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\b`);
    let runtimeUse = false;
    let testUse = false;
    for (const [other, otherText] of texts) {
      if (other === file || !word.test(otherText)) continue;
      if (isTest(other)) {
        testUse = true;
      } else if (!isBarrel(otherText)) {
        runtimeUse = true;
        break;
      }
    }
    if (runtimeUse) continue;
    const declaration = text.slice(
      Math.max(0, text.search(new RegExp(`export[^\\n]*\\b${name}\\b`)) - 200),
      text.search(new RegExp(`export[^\\n]*\\b${name}\\b`)),
    );
    if (testUse && /@internal test/.test(declaration)) continue;
    findings.push(`${testUse ? 'test-only' : 'dead     '}  ${rel(file)}  ${name}`);
  }
}

findings.sort();
for (const line of findings) console.log(line);
console.log(`find-dead-exports: ${findings.length} findings`);
process.exit(findings.length > 0 ? 1 : 0);
