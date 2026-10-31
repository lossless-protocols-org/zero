import StorageService from './storage';
import {SUPPORT_EMAIL} from '../constants/links';

const ERROR_LOG_KEY = 'error_log';
const CRASH_PROMPTED_KEY = 'crash_report_prompted_at';
const MAX_ENTRIES = 20;
// A Hermes release frame is ~40-70 chars ("goBack@1:1924824"), so 500 chars
// kept only the top ~8 frames and the shared report stopped before the frame
// that said which screen was open. 6000 keeps ~100 frames — the whole stack
// for anything this app produces — at a worst case of 20 x ~7 KB in MMKV.
const MAX_MESSAGE_CHARS = 1000;
/** @internal test */
export const MAX_STACK_CHARS = 6000;

export interface ErrorLogEntry {
  timestamp: string;
  message: string;
  stack: string;
  fatal: boolean;
  /** An unhandled promise rejection: not fatal, but the next launch asks about it like one (M7). */
  unhandled?: boolean;
}

/** Device facts worth putting in a report. None of them identify a person. */
export interface ReportMeta {
  appVersion: string;
  os: string;
  osVersion: string;
  brand?: string;
  model?: string;
}

/**
 * The newest fatal entry the user has not been asked about yet, or null.
 *
 * Play Console strips the message from every React Native JS crash, and this
 * app ships no crash reporter by design — so the only copy of a fatal error's
 * text is the one `globalErrorHandler` writes here a moment before the process
 * dies. Asking once, on the next launch, is how that copy reaches the
 * developer: the user taps Share or Not now, and either way the same crash is
 * never asked about twice (`lastPromptedAt`). Pure, so it is unit-testable.
 */
export const getUnreportedFatal = (entries: ErrorLogEntry[], lastPromptedAt: string | null): ErrorLogEntry | null => {
  let newest: ErrorLogEntry | null = null;
  for (const entry of entries) {
    if (!entry.fatal && !entry.unhandled) {
      continue;
    }
    if (lastPromptedAt && entry.timestamp <= lastPromptedAt) {
      continue;
    }
    if (!newest || entry.timestamp > newest.timestamp) {
      newest = entry;
    }
  }
  return newest;
};

/**
 * Plain-text report for the OS share sheet. The stack keeps its minified
 * `@1:NNNNNN` frames on purpose — they decode against the release source map
 * kept per build (metro-symbolicate), and nothing else in the text can.
 */
export const formatErrorReport = (entries: ErrorLogEntry[], meta: ReportMeta): string => {
  const header = [
    'zero crash report - please send to hello@lossless.dev',
    `app: zero ${meta.appVersion}`,
    `device: ${[meta.brand, meta.model].filter(Boolean).join(' ') || 'unknown'}`,
    `os: ${meta.os} ${meta.osVersion}`,
    'contains: error messages and code locations only. No transactions, categories, names or amounts.',
  ].join('\n');
  const body = entries
    .slice()
    .reverse()
    .map(entry => `[${entry.timestamp}] ${entry.fatal ? 'FATAL' : 'ERROR'}: ${entry.message}\n${entry.stack}`)
    .join('\n\n');
  return `${header}\n\n${body}`;
};

/**
 * A `mailto:` URL is the longest-lived, most universal way to hand a report to
 * the developer: no server, no SDK, no account, and the user sees exactly what
 * will be sent before they press Send. Mail clients and the OS intent layer do
 * cap URL length (a few tens of KB at best, far less on some Android mailers),
 * so the body is bounded here rather than left to fail silently on the way out.
 * The full text is always available through "Share log".
 * @internal test
 */
export const MAILTO_BODY_MAX_CHARS = 6000;

export const buildErrorMailto = (entries: ErrorLogEntry[], meta: ReportMeta, to: string = SUPPORT_EMAIL): string => {
  const device = [meta.brand, meta.model].filter(Boolean).join(' ') || 'unknown device';
  const subject = `zero ${meta.appVersion} · ${meta.os} ${meta.osVersion} · ${device} · error report`;
  let body = formatErrorReport(entries, meta);
  if (body.length > MAILTO_BODY_MAX_CHARS) {
    body =
      body.slice(0, MAILTO_BODY_MAX_CHARS) + '\n\n[truncated - open Diagnostics and use "Share log" for the full text]';
  }
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

export const getLastCrashPromptedAt = (): string | null => StorageService.getItemSync(CRASH_PROMPTED_KEY);

export const setLastCrashPromptedAt = (timestamp: string): void => {
  StorageService.setItemSync(CRASH_PROMPTED_KEY, timestamp);
};

/** True when `value` has the four ErrorLogEntry fields with the right primitive types. */
const isEntry = (value: unknown): value is ErrorLogEntry =>
  typeof value === 'object' &&
  value !== null &&
  'timestamp' in value &&
  typeof value.timestamp === 'string' &&
  'message' in value &&
  typeof value.message === 'string' &&
  'stack' in value &&
  typeof value.stack === 'string' &&
  'fatal' in value &&
  typeof value.fatal === 'boolean' &&
  (!('unhandled' in value) || typeof value.unhandled === 'boolean');

/**
 * File paths, URIs and quoted file names are replaced before storing (M8,
 * v2.7.1). The report header promises "no names", but a failed file read
 * embeds the picked file's URI (on Android a SAF `content://` URI often ends
 * in the display name), and iOS Foundation errors quote the display name in
 * curly quotes with no path at all. Idempotent: '<path>' matches nothing.
 */
const PATH_START = String.raw`(?:(?:content|file):|\/)`;
// Each quote style closes only with its own closer; a single-quoted path ends
// at a quote followed by a separator, so an apostrophe inside the name
// ("Ada's backup.json") cannot end it early.
const QUOTED_PATHS: ReadonlyArray<[RegExp, string]> = [
  [new RegExp(`'${PATH_START}[^\n]*?'(?=[\\s,;:)\\]]|$)`, 'gim'), "'<path>'"],
  [new RegExp(`"${PATH_START}[^"\n]*"`, 'gi'), '"<path>"'],
  [new RegExp(`‘${PATH_START}[^’\n]*’`, 'gi'), '‘<path>’'],
];
// iOS: The file “zero backup Ada.json” couldn’t be opened…
const CURLY_QUOTED_NAME = /“[^”\n]*”/g;
// An unquoted path runs until whitespace, a quote, a bracket or a separator.
const BARE_PATH =
  /(?:(?:content|file):\/\/|\/(?:storage|sdcard|mnt|data|private\/var|var\/mobile|Users)\/)[^\s'"“”‘’)\]>,;]+/gi;

const scrubPaths = (text: string): string =>
  QUOTED_PATHS.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text)
    .replace(CURLY_QUOTED_NAME, '“<name>”')
    .replace(BARE_PATH, '<path>');

interface StoredLog {
  entries: ErrorLogEntry[];
  /** Entries dropped as malformed, or -1 when the whole value was unreadable. */
  dropped: number;
}

/** A non-Error reason keeps its content: "[object Object]" tells the reader nothing. */
const describeReason = (reason: unknown): string => {
  if (typeof reason === 'object' && reason !== null) {
    try {
      return JSON.stringify(reason);
    } catch {
      // circular or otherwise unserialisable
    }
  }
  return String(reason);
};

const toError = (reason: unknown): Error => (reason instanceof Error ? reason : new Error(describeReason(reason)));

/**
 * The stored log, or [] when the value is missing, unparseable or not a list
 * (M6, v2.7.1). Entries of the wrong shape are dropped individually: this
 * file is the key's only writer, but Diagnostics must never throw at render
 * because of what it finds here.
 */
const readStoredLog = (): StoredLog => {
  const raw = StorageService.getItemSync(ERROR_LOG_KEY);
  if (!raw) {
    return {entries: [], dropped: 0};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return {entries: [], dropped: -1};
    }
    const valid = parsed.filter(isEntry);
    // Entries written before 2.7.1 were stored unscrubbed; scrubbing is idempotent.
    const entries = valid.map(e => ({...e, message: scrubPaths(e.message), stack: scrubPaths(e.stack)}));
    return {entries, dropped: parsed.length - valid.length};
  } catch {
    return {entries: [], dropped: -1};
  }
};

const readEntries = (): ErrorLogEntry[] => readStoredLog().entries;

export const appendErrorLog = (thrown: unknown, fatal: boolean = false, options: {unhandled?: boolean} = {}): void => {
  try {
    const error = toError(thrown);
    const entry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      // Scrub before truncating, so a path cut at the limit cannot lose its closing quote.
      message: scrubPaths(error.message || 'Unknown error').slice(0, MAX_MESSAGE_CHARS),
      stack: scrubPaths(error.stack || '').slice(0, MAX_STACK_CHARS),
      fatal,
      ...(options.unhandled ? {unhandled: true} : {}),
    };

    const stored = readStoredLog();
    let entries = stored.entries;
    if (stored.dropped !== 0) {
      // The log is the evidence; corruption of it must leave a trace (M6).
      entries.push({
        timestamp: entry.timestamp,
        message:
          stored.dropped < 0
            ? 'error_log: stored value was unreadable and was reset'
            : `error_log: dropped ${stored.dropped} malformed entr${stored.dropped === 1 ? 'y' : 'ies'}`,
        stack: '',
        fatal: false,
      });
    }
    entries.push(entry);
    if (entries.length > MAX_ENTRIES) {
      entries = entries.slice(-MAX_ENTRIES);
    }

    StorageService.setItemSync(ERROR_LOG_KEY, JSON.stringify(entries));
  } catch (storageError) {
    // Storage itself failed; in production there is nowhere else to write.
    if (__DEV__) {
      console.error('[errorLog] append failed', storageError, thrown);
    }
  }
};

export const getErrorLog = (): ErrorLogEntry[] => {
  try {
    return readEntries();
  } catch {
    // Storage itself failed to read; an empty log is all Diagnostics can show.
    return [];
  }
};

/** Returns false when storage refused, so the caller does not claim the log is empty. */
export const clearErrorLog = (): boolean => {
  try {
    StorageService.removeItemSync(ERROR_LOG_KEY);
    return true;
  } catch (error) {
    if (__DEV__) {
      console.error('[errorLog] clear failed', error);
    }
    return false;
  }
};

/** A dialog rejected because its provider unmounted is a consequence, not a cause (M5). */
const isConsequence = (reason: unknown): boolean => reason instanceof Error && reason.name === 'DialogUnmountedError';

/**
 * Release builds' Hermes rejection tracker reports here (globalErrorHandler).
 * Flagged `unhandled` so CrashReportPrompt asks about it on the next launch:
 * logged as plain non-fatal, a rejection nobody handled was never surfaced (M7).
 */
export const recordUnhandledRejection = (reason: unknown): string => {
  if (isConsequence(reason)) {
    return '';
  }
  const error = reason instanceof Error ? reason : new Error(`Unhandled promise rejection: ${describeReason(reason)}`);
  appendErrorLog(error, false, {unhandled: true});
  return readEntries().at(-1)?.timestamp ?? '';
};

/**
 * The tracker reports a rejection as unhandled after a delay; if the app
 * then handles it after all, the entry stays as a record but must not make
 * the next launch ask about it (M7).
 */
export const markRejectionHandled = (timestamp: string): void => {
  try {
    const entries = readEntries();
    const entry = entries.find(e => e.timestamp === timestamp && e.unhandled);
    if (!entry) {
      return;
    }
    entry.unhandled = false;
    StorageService.setItemSync(ERROR_LOG_KEY, JSON.stringify(entries));
  } catch {
    // Storage failed; at worst the next launch asks about a handled rejection.
  }
};

/**
 * For a promise nobody awaits (an event handler, a share sheet, a cleanup):
 * a rejection goes to the error log instead of nowhere (M7, v2.7.1).
 */
export const logRejection = (promise: Promise<unknown>): void => {
  promise.catch((reason: unknown) => {
    if (isConsequence(reason)) {
      return;
    }
    // Nothing else handles it, so it counts as unhandled for the next-launch
    // prompt — these are the failures that look like a button doing nothing.
    appendErrorLog(reason, false, {unhandled: true});
  });
};

/** Key used to avoid asking about the same non-fatal message every launch. */
const CRASH_PROMPTED_MESSAGE_KEY = 'crash_report_prompted_message';
export const getLastPromptedMessage = (): string | null => StorageService.getItemSync(CRASH_PROMPTED_MESSAGE_KEY);
export const setLastPromptedMessage = (message: string): void => {
  StorageService.setItemSync(CRASH_PROMPTED_MESSAGE_KEY, message);
};
