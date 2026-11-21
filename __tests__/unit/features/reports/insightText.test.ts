/** An insight in words (plan P12): every kind has its sentence, with the figures it rests on in it. */
import i18next from 'i18next';
import en from '../../../../src/i18n/locales/en.json';
import type {Insight} from '../../../../src/domain/trends';
import {insightText} from '../../../../src/features/reports/insightText';

const i18n = i18next.createInstance();
beforeAll(() => i18n.init({lng: 'en', resources: {en: {translation: en}}, interpolation: {escapeValue: false}}));

const money = (amount: number) => `₹${amount}`;
const name = (id: string) => ({food: 'Food', fuel: 'Fuel'})[id] ?? '?';
const say = (insight: Insight) => insightText(insight, i18n.t.bind(i18n), money, name);

it('says each fact with its numbers, and nothing that reads as advice or a forecast', () => {
  const lines = [
    say({kind: 'spentAboveAverage', percent: 25, spent: 1250, average: 1000, months: 3}),
    say({kind: 'spentBelowAverage', percent: 20, spent: 800, average: 1000, months: 3}),
    say({kind: 'categoryAboveAverage', categoryId: 'food', percent: 40, spent: 700, average: 500, months: 6}),
    say({kind: 'categoryBelowAverage', categoryId: 'fuel', percent: 50, spent: 150, average: 300, months: 6}),
    say({kind: 'biggestCategory', categoryId: 'food', percent: 56, spent: 700}),
    say({kind: 'highestOfMonths', months: 4, spent: 1250}),
    say({kind: 'lowestOfMonths', months: 4, spent: 800}),
    say({kind: 'keptShare', percent: 38, kept: 750, received: 2000}),
    say({kind: 'spentMoreThanReceived', over: 300, received: 500}),
  ];
  expect(lines).toEqual([
    'You spent 25% more than your average of the 3 months before (₹1250 against ₹1000).',
    'You spent 20% less than your average of the 3 months before (₹800 against ₹1000).',
    'Food was 40% above its average of the 6 months before (₹700 against ₹500).',
    'Fuel was 50% below its average of the 6 months before (₹150 against ₹300).',
    'Food was the biggest category: 56% of spending (₹700).',
    'It was the highest spending of these 4 months.',
    'It was the lowest spending of these 4 months.',
    'You kept 38% of the money that came in (₹750 of ₹2000).',
    'You spent ₹300 more than came in (₹500).',
  ]);
  // Arithmetic on the user's own records, never advice (plan P14's rule for the same sentences).
  for (const line of lines) {
    expect(line).not.toMatch(/should|must|try to|will be|expect|forecast|recommend|save more|cut/i);
    expect(line).not.toContain('{{');
  }
});
