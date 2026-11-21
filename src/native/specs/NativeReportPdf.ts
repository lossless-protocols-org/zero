import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

/**
 * PDF reports (3.0, plan P12), drawn by the platforms' own APIs with no
 * library and no web view: Android `bridge/ReportPdfModule.kt` (PdfDocument
 * and StaticLayout), iOS `ios/zero/Reports/ZeroReportPdf.mm` (UIGraphics PDF
 * context and attributed strings; Swift in ios/ZeroReports). The app decides
 * every word and number (a JSON ReportDoc, src/pro/reportPdf.ts); the native
 * side only lays it out on A4 pages. The file stays in the app's cache until
 * the user sends it somewhere through the system share sheet. Nothing leaves
 * the phone by itself. src/pro/reportPdf.ts is the only importer.
 */
/** @internal codegen — RN codegen reads this to generate NativeReportPdfSpec. */
export interface Spec extends TurboModule {
  /** Draws `json` (a ReportDoc) as `fileName` in the cache's reports folder, replacing what was there. Resolves the path. */
  render(json: string, fileName: string): Promise<string>;
  /** Shows the system share sheet for a file `render` made. Resolves once it is up (Android) or closed (iOS). */
  share(path: string, title: string): Promise<void>;
}

export default TurboModuleRegistry.get<Spec>('NativeReportPdf');
