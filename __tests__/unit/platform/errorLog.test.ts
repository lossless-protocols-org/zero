import {
  appendErrorLog,
  buildErrorMailto,
  clearErrorLog,
  formatErrorReport,
  getErrorLog,
  getUnreportedFatal,
  MAILTO_BODY_MAX_CHARS,
  MAX_STACK_CHARS,
  type ErrorLogEntry,
} from '../../../src/platform/errorLog';
import {SUPPORT_EMAIL} from '../../../src/constants/links';

const entry = (overrides: Partial<ErrorLogEntry>): ErrorLogEntry => ({
  timestamp: '2026-10-18T10:00:00.000Z',
  message: 'TypeError: Object is not a function',
  stack: 'goBack@1:1924824\n_performTransitionSideEffects@1:2304864',
  fatal: true,
  ...overrides,
});

describe('getUnreportedFatal', () => {
  it('returns the newest fatal when nothing has been asked about yet', () => {
    const older = entry({timestamp: '2026-10-17T09:00:00.000Z'});
    const newer = entry({timestamp: '2026-10-18T10:00:00.000Z'});
    expect(getUnreportedFatal([older, newer], null)).toBe(newer);
    expect(getUnreportedFatal([newer, older], null)).toBe(newer);
  });

  it('ignores non-fatal entries', () => {
    const warning = entry({fatal: false, timestamp: '2026-10-19T00:00:00.000Z'});
    expect(getUnreportedFatal([warning], null)).toBeNull();
    expect(getUnreportedFatal([warning, entry({})], null)?.fatal).toBe(true);
  });

  it('never asks twice about the same crash', () => {
    const crash = entry({});
    expect(getUnreportedFatal([crash], crash.timestamp)).toBeNull();
  });

  it('asks again only for a crash newer than the last prompt', () => {
    const asked = entry({timestamp: '2026-10-18T10:00:00.000Z'});
    const later = entry({timestamp: '2026-10-18T11:00:00.000Z'});
    expect(getUnreportedFatal([asked, later], asked.timestamp)).toBe(later);
  });

  it('returns null for an empty log', () => {
    expect(getUnreportedFatal([], null)).toBeNull();
  });
});

describe('formatErrorReport', () => {
  const meta = {appVersion: '2.6.7', os: 'android', osVersion: '15', brand: 'motorola', model: 'moto g84 5G'};

  it('leads with where to send it, the app version and the device', () => {
    const report = formatErrorReport([entry({})], meta);
    const lines = report.split('\n');
    expect(lines[0]).toContain('hello@lossless.dev');
    expect(lines[1]).toBe('app: zero 2.6.7');
    expect(lines[2]).toBe('device: motorola moto g84 5G');
    expect(lines[3]).toBe('os: android 15');
  });

  it('keeps the minified frames intact so the source map can decode them', () => {
    const report = formatErrorReport([entry({})], meta);
    expect(report).toContain('goBack@1:1924824');
    expect(report).toContain('FATAL: TypeError: Object is not a function');
  });

  it('lists newest first', () => {
    const older = entry({timestamp: '2026-10-17T09:00:00.000Z', message: 'older'});
    const newer = entry({timestamp: '2026-10-18T10:00:00.000Z', message: 'newer'});
    const report = formatErrorReport([older, newer], meta);
    expect(report.indexOf('newer')).toBeLessThan(report.indexOf('older'));
  });

  it('says what the report does not contain', () => {
    expect(formatErrorReport([], meta)).toContain('No transactions, categories, names or amounts');
  });

  it('copes with a device that reports no brand or model', () => {
    const report = formatErrorReport([], {appVersion: '2.6.7', os: 'ios', osVersion: '18.1'});
    expect(report).toContain('device: unknown');
  });
});

describe('buildErrorMailto', () => {
  const meta = {appVersion: '2.6.8', os: 'android', osVersion: '15', brand: 'motorola', model: 'moto g84 5G'};

  const decode = (url: string) => {
    const [, query] = url.split('?');
    const params = new URLSearchParams(query);
    return {subject: params.get('subject') ?? '', body: params.get('body') ?? ''};
  };

  it('addresses the support inbox and names version, OS and device in the subject', () => {
    const url = buildErrorMailto([entry({})], meta);
    expect(url.startsWith(`mailto:${SUPPORT_EMAIL}?`)).toBe(true);
    expect(decode(url).subject).toBe('zero 2.6.8 · android 15 · motorola moto g84 5G · error report');
  });

  it('carries the same report text the share sheet gets, newline-safe', () => {
    const url = buildErrorMailto([entry({})], meta);
    const {body} = decode(url);
    expect(body).toBe(formatErrorReport([entry({})], meta));
    expect(body).toContain('goBack@1:1924824');
    expect(url).not.toContain('\n');
  });

  it('bounds the body so a long log cannot exceed what mail clients accept', () => {
    const big = Array.from({length: 20}, (_, i) =>
      entry({timestamp: `2026-10-18T10:${String(i).padStart(2, '0')}:00.000Z`, stack: 'x'.repeat(MAX_STACK_CHARS)}),
    );
    const {body} = decode(buildErrorMailto(big, meta));
    expect(body.length).toBeLessThanOrEqual(MAILTO_BODY_MAX_CHARS + 120);
    expect(body).toContain('[truncated');
    // newest entry survives the cut — it is the one the user is writing about
    expect(body).toContain('2026-10-18T10:19:00.000Z');
  });

  it('can address a different recipient without changing the report', () => {
    const url = buildErrorMailto([], meta, 'someone@example.com');
    expect(url.startsWith('mailto:someone@example.com?')).toBe(true);
  });
});

describe('appendErrorLog → formatErrorReport', () => {
  beforeEach(() => clearErrorLog());

  it('keeps a whole Hermes release stack, not just the top frames', () => {
    // 100 frames of the shape Hermes emits in release (~45 chars each).
    const frames = Array.from({length: 100}, (_, i) => `frame${i}@1:${1000000 + i * 1234}`);
    const error = new Error('TypeError: Object is not a function');
    error.stack = frames.join('\n');
    appendErrorLog(error, true);

    const [stored] = getErrorLog();
    expect(stored?.stack).toContain('frame99@1:');
    expect(stored?.stack.length).toBeLessThanOrEqual(MAX_STACK_CHARS);

    const report = formatErrorReport(getErrorLog(), {appVersion: '2.6.7', os: 'android', osVersion: '15'});
    expect(report).toContain('frame99@1:');
    expect(report.split('\n').filter(line => line.startsWith('frame'))).toHaveLength(100);
  });

  it('still bounds a runaway stack', () => {
    const error = new Error('boom');
    error.stack = 'x'.repeat(MAX_STACK_CHARS * 3);
    appendErrorLog(error, false);
    expect(getErrorLog()[0]?.stack).toHaveLength(MAX_STACK_CHARS);
  });
});
