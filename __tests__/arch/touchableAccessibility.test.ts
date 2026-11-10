/**
 * Every touchable says what it is, and has something to say (audit 2026-11-08
 * §9). The automated accessibility pass found elements by their text, so it
 * passed while TalkBack and VoiceOver announced the date field, the icon and
 * colour pickers, debtor rows and onboarding chips with no "button" at all.
 *
 * For each TouchableOpacity, TouchableHighlight, TouchableWithoutFeedback and
 * Pressable in the app:
 * - it has `accessibilityRole` (or `role`), or is `accessible={false}` (a
 *   touch-only wrapper around an element that carries its own role), or
 *   spreads props it was given (React Navigation's tab button);
 * - it has an `accessibilityLabel`, or text inside it to read: an icon alone
 *   reads as nothing.
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {fromRoot} from '../harness/paths';

const TOUCHABLES = new Set(['TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback', 'Pressable']);
/** Elements a screen reader can read text from. */
const TEXT_ELEMENTS = new Set(['Text', 'PrimaryText', 'Amount', 'TextInput']);

const walk = (dir: string): string[] =>
  fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });

const sources = [...walk(fromRoot('src')), fromRoot('App.tsx')].filter(file => file.endsWith('.tsx'));

interface Finding {
  where: string;
  problem: string;
}

const attribute = (element: ts.JsxOpeningLikeElement, name: string): ts.JsxAttribute | undefined =>
  element.attributes.properties.find(
    (prop): prop is ts.JsxAttribute => ts.isJsxAttribute(prop) && prop.name.getText() === name,
  );

/** True when the element or anything inside it is one a screen reader reads text from. */
const containsText = (node: ts.Node): boolean => {
  let found = false;
  const visit = (child: ts.Node): void => {
    if (found) {
      return;
    }
    if (
      (ts.isJsxOpeningElement(child) || ts.isJsxSelfClosingElement(child)) &&
      TEXT_ELEMENTS.has(child.tagName.getText())
    ) {
      found = true;
      return;
    }
    // `{children}` or `{content}`: text the caller passes in; the component cannot know, so trust it.
    if (ts.isJsxExpression(child) && child.expression && ts.isIdentifier(child.expression)) {
      found = true;
      return;
    }
    ts.forEachChild(child, visit);
  };
  ts.forEachChild(node, visit);
  return found;
};

const findingsIn = (file: string): Finding[] => {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const findings: Finding[] = [];
  const visit = (node: ts.Node): void => {
    const opening = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : undefined;
    if (opening && TOUCHABLES.has(opening.tagName.getText())) {
      const where = `${path.relative(fromRoot(), file)}:${source.getLineAndCharacterOfPosition(opening.getStart()).line + 1}`;
      const spreads = opening.attributes.properties.some(ts.isJsxSpreadAttribute);
      const touchOnly = attribute(opening, 'accessible')?.initializer?.getText().includes('false') ?? false;
      if (!spreads && !touchOnly) {
        if (!attribute(opening, 'accessibilityRole') && !attribute(opening, 'role')) {
          findings.push({where, problem: 'no accessibilityRole'});
        }
        if (!attribute(opening, 'accessibilityLabel') && !(ts.isJsxElement(node) && containsText(node))) {
          findings.push({where, problem: 'nothing to read: no accessibilityLabel and no text inside'});
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return findings;
};

it('scans the app’s screens and components', () => {
  expect(sources.length).toBeGreaterThan(100);
});

it('every touchable has a role and something to read', () => {
  expect(sources.flatMap(findingsIn)).toEqual([]);
});
