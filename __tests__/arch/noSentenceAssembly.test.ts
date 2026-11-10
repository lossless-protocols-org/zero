/**
 * Sentences are whole keys with placeholders, never assembled around a
 * translation in code (audit 2026-11-08 §9). `${amount} ${t('home.remaining')}`
 * fixed English word order for every language ("₹400 left" is "noch 400 ₹"
 * or "متبقي ٤٠٠"); `home.amountLeft` is "{{amount}} left", and a translator
 * moves the placeholder. Required before the store-listing languages become
 * app translations.
 *
 * Flagged, in src/ and App.tsx:
 * - a template literal with `${t(…)}` and anything else in it;
 * - `+` with a `t(…)` call on either side;
 * - JSX text beside a `{t(…)}` in the same element ("{t('x')}: {y}"). A
 *   separator alone ("· {t('x')}") is decoration, not word order, and passes.
 *
 * A list of separate facts joined for a screen reader (`[a, b].join(', ')`)
 * is not a sentence and is not flagged.
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {fromRoot} from '../harness/paths';

const walk = (dir: string): string[] =>
  fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });

/** Punctuation that only separates ("·", "—", "/"): no word order in it. */
const SEPARATORS = /[\s·•|/–—-]/g;

const sources = [...walk(fromRoot('src')), fromRoot('App.tsx')].filter(file => /\.tsx?$/.test(file));

/** `t('…')`, `i18n.t('…')` */
const isTranslation = (node: ts.Node): boolean =>
  ts.isCallExpression(node) &&
  ((ts.isIdentifier(node.expression) && node.expression.text === 't') ||
    (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 't'));

const findingsIn = (file: string): string[] => {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const findings: string[] = [];
  const at = (node: ts.Node, what: string) =>
    findings.push(
      `${path.relative(fromRoot(), file)}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1} ${what}`,
    );

  const visit = (node: ts.Node): void => {
    if (ts.isTemplateExpression(node) && node.templateSpans.some(span => isTranslation(span.expression))) {
      const hasOther =
        node.head.text.trim() !== '' ||
        node.templateSpans.length > 1 ||
        node.templateSpans.some(span => span.literal.text.trim() !== '');
      if (hasOther) {
        at(node, `template around t(): ${node.getText()}`);
      }
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.PlusToken &&
      (isTranslation(node.left) || isTranslation(node.right))
    ) {
      at(node, `"+" with t(): ${node.getText()}`);
    }
    if (ts.isJsxElement(node)) {
      const children = node.children;
      const translated = children.some(
        child => ts.isJsxExpression(child) && child.expression !== undefined && isTranslation(child.expression),
      );
      const text = children.some(child => ts.isJsxText(child) && child.getText().replace(SEPARATORS, '') !== '');
      if (translated && text) {
        at(
          node,
          `JSX text beside {t()}: ${children
            .map(c => c.getText())
            .join('')
            .trim()}`,
        );
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return findings;
};

it('scans the app’s source', () => {
  expect(sources.length).toBeGreaterThan(200);
});

it('no sentence is assembled around a translation', () => {
  expect(sources.flatMap(findingsIn)).toEqual([]);
});
