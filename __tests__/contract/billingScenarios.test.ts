/**
 * contracts/billing-scenarios.json from the app's side (3.0). Each platform
 * turns its own store facts into an answer (Swift: ios/ZeroBilling, checked by
 * BillingScenariosTests; Kotlin: android/app/src/play, PlayAnswerScenariosTest). Here: every answer in the
 * fixture is one the app accepts as it stands, and it means what the fixture
 * says for Pro. So the native side and the app cannot read one situation
 * differently, and a status or key renamed on either side fails a suite.
 */
import fs from 'node:fs';
import {NO_ENTITLEMENT, reduce} from '../../src/pro/entitlement';
import {productKind} from '../../src/pro/products';
import {parseStoreAnswer, type Entitlement, type EntitlementState} from '../../src/pro/schema';
import {fromRoot} from '../harness/paths';

type Platform = 'ios' | 'android';

interface Scenario {
  name: string;
  ios?: {facts: unknown[]; answer: unknown};
  android?: {facts: unknown[]; answer: unknown};
  entitlement: {state: EntitlementState; alsoSubscribed: boolean};
  whenProBefore: {lifetime: EntitlementState; renewingMonthly: EntitlementState};
}

interface Fixture {
  nowMs: number;
  products: Partial<Record<Platform, {subscription: string[]; lifetime: string[]}>>;
  scenarios: Scenario[];
}

// The repository's own fixture; the assertions below are what check its shape.
const fixture = JSON.parse(fs.readFileSync(fromRoot('contracts', 'billing-scenarios.json'), 'utf8')) as Fixture;

const PLATFORMS: Platform[] = ['ios', 'android'];
const cases = fixture.scenarios.flatMap(scenario =>
  PLATFORMS.flatMap(platform => {
    const side = scenario[platform];
    return side
      ? [
          {
            label: `${platform}: ${scenario.name}`,
            platform,
            answer: side.answer,
            expected: scenario.entitlement,
            whenProBefore: scenario.whenProBefore,
          },
        ]
      : [];
  }),
);

it('has scenarios to check, each named once', () => {
  expect(cases.length).toBeGreaterThan(20);
  const names = fixture.scenarios.map(scenario => scenario.name);
  expect(new Set(names).size).toBe(names.length);
});

it('names the products the app sells, by kind', () => {
  const listed = Object.values(fixture.products);
  expect(listed.length).toBeGreaterThan(0);
  for (const products of listed) {
    expect(products.subscription.map(productKind)).toEqual(products.subscription.map(() => 'subscription'));
    expect(products.lifetime.map(productKind)).toEqual(products.lifetime.map(() => 'lifetime'));
  }
});

const DAY_MS = 86_400_000;

/** The two phones that had Pro (the fixture's `about` says which). */
const proBefore = (platform: Platform): {lifetime: Entitlement; renewingMonthly: Entitlement} => {
  const products = fixture.products[platform];
  const [lifetime] = products?.lifetime ?? [];
  const [monthly] = products?.subscription ?? [];
  if (!lifetime || !monthly) {
    throw new Error(`the fixture names no ${platform} products`);
  }
  return {
    lifetime: {...NO_ENTITLEMENT, state: 'lifetime', productId: lifetime},
    renewingMonthly: {
      ...NO_ENTITLEMENT,
      state: 'subscribed',
      productId: monthly,
      // Google Play's client reports no end date, so none is ever stored there.
      expiresAtMs: platform === 'ios' ? fixture.nowMs - DAY_MS : null,
      willRenew: true,
    },
  };
};

describe.each(cases)('$label', ({platform, answer, expected, whenProBefore}) => {
  it('is an answer the app accepts exactly as written', () => {
    // Anything the app could not read would come back as {kind: 'unknown', reason: 'malformed'}.
    expect(parseStoreAnswer(JSON.stringify(answer))).toEqual(answer);
  });

  it('means what the fixture says for a phone that never had Pro', () => {
    const next = reduce(parseStoreAnswer(JSON.stringify(answer)), NO_ENTITLEMENT, fixture.nowMs);
    expect({state: next.state, alsoSubscribed: next.alsoSubscribed}).toEqual(expected);
  });

  // The half that costs a buyer something: what the same answer does to a phone that has Pro.
  it('means what the fixture says for a phone that had Pro', () => {
    const before = proBefore(platform);
    const after = (last: Entitlement) => reduce(parseStoreAnswer(JSON.stringify(answer)), last, fixture.nowMs).state;
    expect({
      lifetime: after(before.lifetime),
      renewingMonthly: after(before.renewingMonthly),
    }).toEqual(whenProBefore);
  });
});
