/**
 * Plan P11's exit gate: no module works out a month boundary by itself.
 *
 * Which days a month covers, and which month a date belongs to, depend on the
 * user's month start day (Pro). One module knows the rule (src/domain/period.ts)
 * and one decides whether the user's day applies (src/pro/monthStart.ts). A
 * screen or service that takes the first seven characters of a date, builds
 * "YYYY-MM-01", or asks a Date for its month would silently keep calendar
 * months for that one figure, and Home, Reports and the widget would disagree.
 * Every such pattern outside the two domain date modules fails here.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fromRoot} from '../harness/paths';

/** The modules that may do calendar arithmetic on months, each with why. */
const ALLOWED: Record<string, string> = {
  'src/domain/period.ts': 'the rule itself',
  'src/domain/dates.ts': 'daysInMonth, only to tell a real calendar day from an impossible one',
};

const FORBIDDEN: ReadonlyArray<{pattern: RegExp; why: string}> = [
  {pattern: /\.(slice|substring|substr)\(0, 7\)/, why: 'the first seven characters of a date are its calendar month'},
  {pattern: /'YYYY-MM'\)/, why: 'formats a date as its calendar month'},
  {pattern: /-01[`'"]/, why: 'builds the 1st of a calendar month'},
  {pattern: /\.getMonth\(\)|\.month\(\)/, why: 'asks a date for its calendar month'},
  {pattern: /(startOf|endOf)\('month'\)/, why: 'calendar month edges'},
  {pattern: /daysInMonth\(|\.daysInMonth\b/, why: 'a calendar month’s length'},
];

const walk = (dir: string): string[] =>
  fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : /\.tsx?$/.test(entry.name) ? [full] : [];
  });

it('only domain/period.ts works out which days a month covers', () => {
  const found: string[] = [];
  for (const file of walk(fromRoot('src'))) {
    const rel = path.relative(fromRoot(), file);
    if (rel in ALLOWED) {
      continue;
    }
    fs.readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, index) => {
        if (/^\s*(\*|\/\/|\/\*)/.test(line)) {
          return; // a comment may name the pattern it replaced
        }
        for (const {pattern, why} of FORBIDDEN) {
          if (pattern.test(line)) {
            found.push(`${rel}:${index + 1} ${why}: ${line.trim()}`);
          }
        }
      });
  }
  expect(found).toEqual([]);
});

it('the patterns do catch what they are for', () => {
  const samples = [
    'const month = expense.date.slice(0, 7);',
    "const key = dayjs().format('YYYY-MM');",
    'const first = `${yearMonth}-01`;',
    'const index = new Date().getMonth();',
    "const end = dayjs(date).endOf('month');",
    'const days = daysInMonth(year, index);',
  ];
  for (const sample of samples) {
    expect({sample, caught: FORBIDDEN.some(({pattern}) => pattern.test(sample))}).toEqual({sample, caught: true});
  }
  // A day key and a full date format are not month arithmetic.
  for (const fine of ['date.slice(0, 10)', "formatDate(now, 'YYYY-MM-DD')", "const day = '2026-11-01T10:00:00';"]) {
    expect({fine, caught: FORBIDDEN.some(({pattern}) => pattern.test(fine))}).toEqual({fine, caught: false});
  }
});
