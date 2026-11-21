/**
 * The PDF gateway (plan P12): the document goes to the native module as JSON
 * with a file name that is only ever a name, the made file is then shared,
 * a failure reaches the caller, and without the module nothing throws.
 */
import {shareReportPdf, type ReportDoc} from '../../../src/pro/reportPdf';

const mockNative: {current: Record<string, jest.Mock> | null} = {current: null};
jest.mock('../../../src/native/specs/NativeReportPdf', () => ({
  __esModule: true,
  get default() {
    return mockNative.current;
  },
}));

const doc: ReportDoc = {
  title: 'Spending report',
  subtitle: 'November 2026',
  footer: 'Made on this phone with zero',
  direction: 'ltr',
  blocks: [{type: 'text', text: 'Hello'}],
};

afterEach(() => {
  mockNative.current = null;
});

it('without the native module says so and makes nothing', async () => {
  await expect(shareReportPdf(doc, 'zero 2026-11-01')).resolves.toBe('unavailable');
});

it('draws the document, then shares the file it was given back', async () => {
  const render = jest.fn(async () => '/cache/reports/zero-2026-11-01.pdf');
  const share = jest.fn(async () => undefined);
  mockNative.current = {render, share};
  await expect(shareReportPdf(doc, 'zero 2026-11-01')).resolves.toBe('shared');
  expect(render).toHaveBeenCalledWith(JSON.stringify(doc), 'zero-2026-11-01.pdf');
  expect(share).toHaveBeenCalledWith('/cache/reports/zero-2026-11-01.pdf', 'Spending report');
});

it('a file name is only ever a name: no path, no dots, any script', async () => {
  const render = jest.fn<Promise<string>, [string, string]>(async () => '/x.pdf');
  mockNative.current = {render, share: jest.fn(async () => undefined)};
  const nameFor = async (name: string) => {
    await shareReportPdf(doc, name);
    return render.mock.calls.at(-1)?.[1];
  };
  expect(await nameFor('../../etc/passwd')).toBe('etc-passwd.pdf');
  expect(await nameFor('zero trends 2025-12 2026-11')).toBe('zero-trends-2025-12-2026-11.pdf');
  expect(await nameFor('रिपोर्ट नवंबर')).toMatch(/^[\p{L}\p{M}\p{N}-]+\.pdf$/u);
  expect(await nameFor('///')).toBe('report.pdf');
  expect((await nameFor('x'.repeat(200)))?.length).toBe(64);
});

it('a failure to draw is the caller’s to say, and nothing is shared', async () => {
  const share = jest.fn();
  mockNative.current = {render: jest.fn(async () => Promise.reject(new Error('report: IOException'))), share};
  await expect(shareReportPdf(doc, 'x')).rejects.toThrow('IOException');
  expect(share).not.toHaveBeenCalled();
});
