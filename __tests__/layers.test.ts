/**
 * M9 (v2.7.1): one dependency rule for src/, enforced on every test run by
 * scripts/check-layers.mjs (Node only; no dependency-cruiser).
 */
export {};

declare const __dirname: string;
interface ExecError {
  stdout?: string;
}
const {
  execFileSync,
}: {execFileSync: (file: string, args: string[], options: {encoding: 'utf8'}) => string} = require('child_process');

it('src/ has no layer violations and no import cycles', () => {
  const script = `${__dirname}/../scripts/check-layers.mjs`;
  let output: string;
  try {
    output = execFileSync('node', [script], {encoding: 'utf8'});
  } catch (error) {
    // A non-zero exit carries the report on stdout.
    output = (error as ExecError).stdout ?? String(error); // execFileSync throws an Error carrying stdout
  }
  expect(output).not.toMatch(/^(violation|cycle) /m);
  expect(output.trim().split('\n').pop()).toMatch(/, 0 violations, 0 cycles$/);
});
