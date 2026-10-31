/**
 * M14 (v2.7.1): no export goes unused; test-only ones say so with
 * `@internal test`. Enforced by scripts/find-dead-exports.mjs.
 */
export {};

declare const __dirname: string;
interface ExecError {
  stdout?: string;
}
const {
  execFileSync,
}: {execFileSync: (file: string, args: string[], options: {encoding: 'utf8'}) => string} = require('child_process');

it('src/ has no unused exports', () => {
  let output: string;
  try {
    output = execFileSync('node', [`${__dirname}/../scripts/find-dead-exports.mjs`], {encoding: 'utf8'});
  } catch (error) {
    // A non-zero exit carries the report on stdout.
    output = (error as ExecError).stdout ?? String(error); // execFileSync throws an Error carrying stdout
  }
  expect(output.trim().split('\n').pop()).toBe('find-dead-exports: 0 findings');
});
