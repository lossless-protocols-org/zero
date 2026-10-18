import StorageService from './asyncStorageService';

const ERROR_LOG_KEY = 'error_log';
const CRASH_PROMPTED_KEY = 'crash_report_prompted_at';
const MAX_ENTRIES = 20;
// A Hermes release frame is ~40-70 chars ("goBack@1:1924824"), so 500 chars
// kept only the top ~8 frames and the shared report stopped before the frame
// that said which screen was open. 6000 keeps ~100 frames — the whole stack
// for anything this app produces — at a worst case of 20 x ~7 KB in MMKV.
export const MAX_MESSAGE_CHARS = 1000;
export const MAX_STACK_CHARS = 6000;

export interface ErrorLogEntry {
  timestamp: string;
  message: string;
  stack: string;
  fatal: boolean;
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
export const getUnreportedFatal = (
  entries: ErrorLogEntry[],
  lastPromptedAt: string | null,
): ErrorLogEntry | null => {
  let newest: ErrorLogEntry | null = null;
  for (const entry of entries) {
    if (!entry.fatal) {
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

export const getLastCrashPromptedAt = (): string | null => StorageService.getItemSync(CRASH_PROMPTED_KEY);

export const setLastCrashPromptedAt = (timestamp: string): void => {
  StorageService.setItemSync(CRASH_PROMPTED_KEY, timestamp);
};

export const appendErrorLog = (error: Error, fatal: boolean = false): void => {
  try {
    const entry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      message: error.message?.slice(0, MAX_MESSAGE_CHARS) || 'Unknown error',
      stack: (error.stack || '').slice(0, MAX_STACK_CHARS),
      fatal,
    };

    const raw = StorageService.getItemSync(ERROR_LOG_KEY);
    let entries: ErrorLogEntry[] = [];
    if (raw) {
      try {
        entries = JSON.parse(raw);
      } catch {
        entries = [];
      }
    }

    entries.push(entry);
    if (entries.length > MAX_ENTRIES) {
      entries = entries.slice(-MAX_ENTRIES);
    }

    StorageService.setItemSync(ERROR_LOG_KEY, JSON.stringify(entries));
  } catch {
    // Storage itself failed — nothing we can do
  }
};

export const getErrorLog = (): ErrorLogEntry[] => {
  try {
    const raw = StorageService.getItemSync(ERROR_LOG_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Corrupted log
  }
  return [];
};

export const clearErrorLog = (): void => {
  StorageService.removeItemSync(ERROR_LOG_KEY);
};
