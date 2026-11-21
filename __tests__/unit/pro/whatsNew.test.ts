/** "What's new in 3.0" is shown once, on update, and never to a new install (owner decision 14). */
import {shouldShowWhatsNew} from '../../../src/pro/whatsNew';

const facts = (more: Partial<Parameters<typeof shouldShowWhatsNew>[0]> = {}) => ({
  firstSeenVersion: '2.8.0',
  appVersion: '3.0.0',
  seen: false,
  ...more,
});

it('an install that updated from before 3.0 sees it', () => {
  expect(shouldShowWhatsNew(facts())).toBe(true);
  expect(shouldShowWhatsNew(facts({firstSeenVersion: '2.7.1', appVersion: '3.2.1'}))).toBe(true);
});

it('once', () => {
  expect(shouldShowWhatsNew(facts({seen: true}))).toBe(false);
});

it('never a new install, or one with no record of where it started', () => {
  expect(shouldShowWhatsNew(facts({firstSeenVersion: '3.0.0'}))).toBe(false);
  expect(shouldShowWhatsNew(facts({firstSeenVersion: null}))).toBe(false);
});

it('not before 3.0, and not once the news is old', () => {
  expect(shouldShowWhatsNew(facts({appVersion: '2.8.1'}))).toBe(false);
  expect(shouldShowWhatsNew(facts({appVersion: '4.0.0'}))).toBe(false);
});
