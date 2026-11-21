/** "Share as PDF" (plan P12): one at a time, built only when asked, and a failure is logged and said. */
import {act} from '@testing-library/react-native';
import {useSharePdf} from '../../../../../src/features/reports/hooks/useSharePdf';
import * as errorLog from '../../../../../src/platform/errorLog';
import * as reportPdf from '../../../../../src/pro/reportPdf';
import {dialogsSaid, resetDialogs} from '../../../../harness/mocks/dialogs';
import {renderHookInApp} from '../../../../harness/render';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
jest.mock('../../../../../src/ui/context/DialogContext', () =>
  require('../../../../harness/mocks/dialogs').dialogContextMock(),
);

const doc: reportPdf.ReportDoc = {title: 't', subtitle: 's', footer: 'f', direction: 'ltr', blocks: []};

beforeEach(() => resetDialogs());
afterEach(() => jest.restoreAllMocks());

it('builds the document when asked and hands it over with its name', async () => {
  const shared = jest.spyOn(reportPdf, 'shareReportPdf').mockResolvedValue('shared');
  const build = jest.fn(() => doc);
  const {result} = await renderHookInApp(() => useSharePdf());
  expect(build).not.toHaveBeenCalled();
  await act(() => result.current.share(build, 'zero 2026-11-01'));
  expect(shared).toHaveBeenCalledWith(doc, 'zero 2026-11-01');
  expect(result.current.sharing).toBe(false);
  expect(dialogsSaid()).toEqual([]);
});

it('two taps make one PDF', async () => {
  let finish: () => void = () => undefined;
  const shared = jest
    .spyOn(reportPdf, 'shareReportPdf')
    .mockImplementation(() => new Promise(resolve => (finish = () => resolve('shared'))));
  const {result} = await renderHookInApp(() => useSharePdf());
  let both: Promise<unknown> = Promise.resolve();
  await act(async () => {
    both = Promise.all([result.current.share(() => doc, 'a'), result.current.share(() => doc, 'b')]);
  });
  expect(result.current.sharing).toBe(true);
  await act(async () => {
    finish();
    await both;
  });
  expect(shared).toHaveBeenCalledTimes(1);
  expect(result.current.sharing).toBe(false);
});

it('a failure is logged and said, and the button works again', async () => {
  const logged = jest.spyOn(errorLog, 'appendErrorLog').mockImplementation(() => undefined);
  jest.spyOn(reportPdf, 'shareReportPdf').mockRejectedValueOnce(new Error('report: IOException'));
  const {result} = await renderHookInApp(() => useSharePdf());
  await act(() => result.current.share(() => doc, 'a'));
  expect(logged).toHaveBeenCalled();
  expect(dialogsSaid()).toEqual(['error: reports.pdfFailed']);
  jest.spyOn(reportPdf, 'shareReportPdf').mockResolvedValue('shared');
  await act(() => result.current.share(() => doc, 'a'));
  expect(dialogsSaid()).toHaveLength(1);
});
