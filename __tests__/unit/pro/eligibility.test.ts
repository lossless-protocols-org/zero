/**
 * Who is shown the thank-you lifetime price (owner decisions 7 to 9): an
 * install that was here before 3.0, until one fixed date. It only chooses a
 * product to show; the price is the store's.
 */
import {FIRST_3_0_BUILD, isThanksEligible, THANKS_ENDS_ON_MS} from '../../../src/pro/eligibility';

const NOW = Date.UTC(2027, 0, 10);
const ENDS = Date.UTC(2027, 2, 1);
const UNSIGNED = {signed: false, build: null};
const facts = (more: Partial<Parameters<typeof isThanksEligible>[0]> = {}) => ({
  firstSeenVersion: '3.0.0',
  originalInstall: UNSIGNED,
  nowMs: NOW,
  endsOnMs: ENDS,
  ...more,
});

it('an install first seen before 3.0 is eligible', () => {
  for (const version of ['2.7.1', '2.8.0', '1.0.0']) {
    expect(isThanksEligible(facts({firstSeenVersion: version}))).toBe(true);
  }
});

it('an install first seen on 3.0 or later is not, nor one with no record', () => {
  for (const version of ['3.0.0', '3.1.2', '4.0.0', null, 'garbage']) {
    expect(isThanksEligible(facts({firstSeenVersion: version}))).toBe(false);
  }
});

it('a reinstall is eligible through the build the store signed', () => {
  const before = {signed: true, build: FIRST_3_0_BUILD - 1};
  expect(isThanksEligible(facts({originalInstall: before}))).toBe(true);
  expect(isThanksEligible(facts({originalInstall: {signed: true, build: FIRST_3_0_BUILD}}))).toBe(false);
  // A value nobody signed is no evidence, whatever it says.
  expect(isThanksEligible(facts({originalInstall: {signed: false, build: 1}}))).toBe(false);
  expect(isThanksEligible(facts({originalInstall: {signed: true, build: null}}))).toBe(false);
});

it('ends on the date, to the millisecond', () => {
  const old = {firstSeenVersion: '2.8.0'};
  expect(isThanksEligible(facts({...old, nowMs: ENDS - 1}))).toBe(true);
  expect(isThanksEligible(facts({...old, nowMs: ENDS}))).toBe(false);
});

it('with no end date set, nobody is eligible: a discount never runs without an end', () => {
  expect(isThanksEligible(facts({firstSeenVersion: '2.8.0', endsOnMs: null}))).toBe(false);
});

it('this tree has no launch date yet, so the offer is off', () => {
  // Set THANKS_ENDS_ON_MS in the release that ships 3.0, and change this line with it.
  expect(THANKS_ENDS_ON_MS).toBeNull();
  expect(isThanksEligible({firstSeenVersion: '2.8.0', originalInstall: UNSIGNED, nowMs: NOW})).toBe(false);
});
