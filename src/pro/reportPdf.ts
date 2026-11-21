import NativeReportPdf from '../native/specs/NativeReportPdf';

/**
 * A report as a document (3.0, plan P12; Pro key `reports`): what the PDF
 * says, decided here in the app, and the one call into the native modules
 * that draw it (NativeReportPdf). The native side lays these blocks out on
 * A4 pages and knows nothing about money or months, so what a PDF contains
 * is exactly what a builder put in its ReportDoc, and that is tested in JS:
 * a report holds only what the screen it was made from shows (law L9's rule
 * for documents made for people).
 *
 * Always light: a document is for sending and printing, whatever theme the
 * app is in.
 */
export interface ReportDoc {
  /** The first line of the first page, e.g. "Spending report". */
  title: string;
  /** Under it: the days covered, e.g. "7 Nov – 6 Dec 2026". */
  subtitle: string;
  /** Left of every page's foot, e.g. "Made on this phone with zero · 12 Nov 2026". The page number is drawn opposite. */
  footer: string;
  /** Right-to-left languages mirror the page. */
  direction: 'ltr' | 'rtl';
  blocks: ReportBlock[];
}

export type ReportBlock =
  | {type: 'heading'; text: string}
  | {type: 'text'; text: string}
  /** Figures side by side (up to four): a small label over a value. */
  | {type: 'stats'; items: Array<{label: string; value: string}>}
  /** Rows of cells. `weight` shares the width; 'end' is for figures. `total` is a last row drawn bold. */
  | {
      type: 'table';
      columns: Array<{title: string; align: 'start' | 'end'; weight: number}>;
      rows: string[][];
      total?: string[];
    }
  /** A label, a bar filled to `fraction` (0 to 1), and a value. */
  | {type: 'bars'; rows: Array<{label: string; value: string; fraction: number}>};

export type ReportOutcome = 'shared' | 'unavailable';

/** A file name from a label: letters and digits kept, anything else a dash. */
const fileNameOf = (name: string): string =>
  `${
    name
      .normalize('NFKD')
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'report'
  }.pdf`;

/**
 * Draws `doc` as a PDF and offers it through the system share sheet. Throws
 * when drawing or sharing fails (the caller says so); 'unavailable' without
 * the native module.
 */
export const shareReportPdf = async (doc: ReportDoc, name: string): Promise<ReportOutcome> => {
  if (!NativeReportPdf) {
    return 'unavailable';
  }
  const path = await NativeReportPdf.render(JSON.stringify(doc), fileNameOf(name));
  await NativeReportPdf.share(path, doc.title);
  return 'shared';
};
