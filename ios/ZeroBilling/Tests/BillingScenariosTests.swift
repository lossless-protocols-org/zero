import XCTest

@testable import ZeroBillingHost

/// The App Store side of contracts/billing-scenarios.json (3.0): for every
/// scenario, the facts StoreKit would report become exactly the answer the
/// fixture names. The JS suite checks what each answer means for Pro, so the
/// two sides cannot read one situation differently.
final class BillingScenariosTests: XCTestCase {
  func testTheCatalogueIsTheOneTheAppKnows() throws {
    let fixture = try Fixtures.scenarios()
    let products = try XCTUnwrap((fixture["products"] as? [String: Any])?["ios"] as? [String: [String]])
    XCTAssertEqual(products["subscription"], BillingCatalogue.subscriptions)
    XCTAssertEqual(products["lifetime"], BillingCatalogue.lifetime)
  }

  func testEveryScenarioMapsToItsAnswer() throws {
    let fixture = try Fixtures.scenarios()
    let scenarios = try XCTUnwrap(fixture["scenarios"] as? [[String: Any]])
    var checked = 0
    for scenario in scenarios {
      let name = try XCTUnwrap(scenario["name"] as? String)
      // A scenario with no App Store side is Google Play's (PlayAnswerScenariosTest.kt).
      guard let ios = scenario["ios"] as? [String: Any] else { continue }
      checked += 1
      let factsData = try JSONSerialization.data(withJSONObject: try XCTUnwrap(ios["facts"], name))
      let facts = try JSONDecoder().decode([ProductFact].self, from: factsData)
      let expected = try XCTUnwrap(ios["answer"] as? NSObject, name)
      let answer = BillingAnswer.answer(facts: facts)
      XCTAssertEqual(try Fixtures.json(answer.json), expected, name)
    }
    XCTAssertGreaterThan(checked, 15, "the fixture was read")
  }

  func testAnAbsentValueIsWrittenAsNullNeverLeftOut() throws {
    let answer = StoreAnswer.known([
      StoreRecord(productId: "zero_pro_lifetime", status: "active", expiresAtMs: nil, willRenew: nil, verified: true)
    ])
    XCTAssertEqual(
      answer.json,
      #"{"entitlements":[{"expiresAtMs":null,"productId":"zero_pro_lifetime","status":"active","verified":true,"willRenew":null}],"kind":"known"}"#
    )
    XCTAssertEqual(StoreAnswer.unknown(reason: "x").json, #"{"kind":"unknown","reason":"x"}"#)
  }

  func testProductsAreWrittenInTheShapeTheAppReads() throws {
    let json = BillingJSON.products([
      OfferedProduct(id: "zero_pro_monthly", displayPrice: "₹99.00", currencyCode: "INR", period: "month", trialDays: 14),
      OfferedProduct(id: "zero_pro_lifetime", displayPrice: "₹1,199.00", currencyCode: "INR", period: nil, trialDays: nil),
    ])
    let expected = try Fixtures.json(
      #"""
      [{"id":"zero_pro_monthly","displayPrice":"₹99.00","currencyCode":"INR","period":"month","trialDays":14,"offerToken":null},
       {"id":"zero_pro_lifetime","displayPrice":"₹1,199.00","currencyCode":"INR","period":null,"trialDays":null,"offerToken":null}]
      """#)
    XCTAssertEqual(try Fixtures.json(json), expected)
  }

  func testTheOriginalBuildIsReadFromWhatTheAppStoreSigned() throws {
    func install(_ version: String?) throws -> NSObject { try Fixtures.json(BillingJSON.originalInstall(signedVersion: version)) }
    // On iOS the signed value is the build number.
    XCTAssertEqual(try install("24"), try Fixtures.json(#"{"signed":true,"build":24}"#))
    // The sandbox and Xcode always say "1.0".
    XCTAssertEqual(try install("1.0"), try Fixtures.json(#"{"signed":true,"build":1}"#))
    XCTAssertEqual(try install("40.2.1"), try Fixtures.json(#"{"signed":true,"build":40}"#))
    let unsigned = try Fixtures.json(#"{"signed":false,"build":null}"#)
    for unreadable in [nil, "", "beta", ".5", "-3", "1e3"] {
      XCTAssertEqual(try install(unreadable), unsigned, String(describing: unreadable))
    }
  }

  func testATrialIsCountedInDays() {
    XCTAssertEqual(BillingJSON.trialDays(unit: "week", value: 2, count: 1), 14)
    XCTAssertEqual(BillingJSON.trialDays(unit: "day", value: 3, count: 1), 3)
    XCTAssertEqual(BillingJSON.trialDays(unit: "week", value: 1, count: 2), 14)
    XCTAssertEqual(BillingJSON.trialDays(unit: "month", value: 1, count: 1), 30)
    XCTAssertEqual(BillingJSON.trialDays(unit: "year", value: 1, count: 1), 365)
    XCTAssertNil(BillingJSON.trialDays(unit: "fortnight", value: 1, count: 1))
    XCTAssertNil(BillingJSON.trialDays(unit: "week", value: 0, count: 1))
  }
}
