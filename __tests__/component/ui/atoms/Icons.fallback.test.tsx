/**
 * An icon name from data the registry does not have (a backup from another
 * build) shows a neutral glyph and is logged once, instead of rendering
 * nothing, which shipped as a blank square (audit 2026-11-08 §5). Names
 * written in code are typed, so a typo there fails to compile.
 */
import React from 'react';
import {render} from '@testing-library/react-native';
import {Icon} from '../../../../src/ui/atoms/Icons';

const mockLog = jest.fn();
jest.mock('../../../../src/platform/errorLog', () => ({appendErrorLog: (e: Error) => mockLog(e.message)}));

/** What a glyph draws (the svg tree); two icons look alike when these match. */
const drawn = async (element: React.ReactElement) => JSON.stringify((await render(element)).toJSON());

it('draws a known name from data, and logs nothing', async () => {
  expect(await drawn(<Icon dynamicName="coins" />)).toBe(await drawn(<Icon name="coins" />));
  expect(mockLog).not.toHaveBeenCalled();
});

it('draws the fallback for an unknown name from data, and logs it once', async () => {
  const fallback = await drawn(<Icon name="circle-dot" />);
  expect(await drawn(<Icon dynamicName="no-such-icon" />)).toBe(fallback);
  expect(fallback).not.toBe(await drawn(<Icon name="coins" />)); // the comparison can tell glyphs apart
  await drawn(<Icon dynamicName="no-such-icon" />);
  expect(mockLog.mock.calls).toEqual([['Icon "no-such-icon" is not in the registry; showing circle-dot']]);
});
