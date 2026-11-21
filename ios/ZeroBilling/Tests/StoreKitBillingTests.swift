import StoreKit
import StoreKitTest
import XCTest

@testable import ZeroBillingHost

/// StoreKitBilling against Apple's own test store (StoreKit Test, the local
/// catalogue in ios/zero/Billing/zero.storekit): real purchases, refunds,
/// renewals and Ask to Buy, with no network and no App Store account. This is
/// what proves the adapter reads StoreKit the way the mapping expects; the
/// mapping itself is BillingScenariosTests.
///
/// One test store is shared by every session, so these run one at a time
/// (XCTest's default) and each starts from an empty store.
final class StoreKitBillingTests: XCTestCase {
  private var session: SKTestSession!  // set in setUp for every test
  private var billing: StoreKitBilling!  // set in setUp for every test

  private let monthly = "zero_pro_monthly"
  private let lifetime = "zero_pro_lifetime"
  private let thanks = "zero_pro_lifetime_thanks"

  override func setUp() async throws {
    session = try SKTestSession(contentsOf: Fixtures.storeKitConfiguration)
    session.resetToDefaultState()
    session.disableDialogs = true
    session.clearTransactions()
    billing = StoreKitBilling()
    // As the app does at launch: StoreKit warns that a purchase made without a listener can be missed.
    await billing.start()
  }

  override func tearDown() async throws {
    // A listener left running would take the next test's updates.
    await billing.stop()
    session.clearTransactions()
    session = nil
    billing = nil
  }

  // MARK: - Helpers

  private struct Record: Equatable {
    var productId: String
    var status: String
    var expiresAtMs: Int64?
    var willRenew: Bool?
    var verified: Bool
  }

  /// The adapter's answer, read back the way the app reads it.
  private func records() async throws -> [Record] {
    let json = await billing.entitlementsJSON()
    let answer = try XCTUnwrap(try Fixtures.json(json) as? [String: Any])
    // "Cannot say" (a store holding no transaction of zero's) reads here as no records.
    return try ((answer["entitlements"] as? [[String: Any]]) ?? []).map { entry in
      Record(
        productId: try XCTUnwrap(entry["productId"] as? String),
        status: try XCTUnwrap(entry["status"] as? String),
        expiresAtMs: (entry["expiresAtMs"] as? NSNumber)?.int64Value,
        willRenew: (entry["willRenew"] as? NSNumber)?.boolValue,
        verified: try XCTUnwrap(entry["verified"] as? Bool))
    }
  }

  /// The status of each product, from the records the app would act on (verified ones; the
  /// first for a product). While the store settles, a product can briefly carry two records
  /// (say, a transaction not yet listed as owned beside a purchase still marked as waiting).
  private func statuses() async throws -> [String: String] {
    Dictionary(try await records().filter(\.verified).map { ($0.productId, $0.status) }, uniquingKeysWith: { first, _ in first })
  }

  /// Waits for the test store to settle: its effects reach StoreKit's cache a moment after the call returns.
  private func eventually(
    _ what: String, file: StaticString = #filePath, line: UInt = #line, _ condition: () async throws -> Bool
  ) async throws {
    // Up to 30 s: the first call on a simulator that has just booted is slow.
    for _ in 0..<300 {
      if try await condition() {
        return
      }
      try await Task.sleep(nanoseconds: 100_000_000)
    }
    XCTFail("never happened: \(what)", file: file, line: line)
  }

  private func transactionID(of productID: String) throws -> UInt {
    let transaction = try XCTUnwrap(
      session.allTransactions().last { $0.productIdentifier == productID }, "no test transaction for \(productID)")
    return transaction.identifier
  }

  // MARK: - What is on offer

  func testOffersTheThreeProductsWithTheStoresOwnPriceText() async throws {
    let json = try await billing.productsJSON([lifetime, monthly, "zero_pro_gold", thanks])
    let products = try XCTUnwrap(try Fixtures.json(json) as? [[String: Any]])
    // In the order asked for, without the product zero does not sell.
    XCTAssertEqual(products.map { $0["id"] as? String }, [lifetime, monthly, thanks])
    let byID = Dictionary(uniqueKeysWithValues: products.map { ($0["id"] as? String ?? "", $0) })
    XCTAssertEqual(byID[monthly]?["period"] as? String, "month")
    XCTAssertEqual((byID[monthly]?["trialDays"] as? NSNumber)?.intValue, 14, "two weeks free for a new subscriber")
    XCTAssertTrue(byID[lifetime]?["period"] is NSNull)
    XCTAssertTrue(byID[lifetime]?["trialDays"] is NSNull)
    for product in products {
      XCTAssertTrue(product["offerToken"] is NSNull)
      XCTAssertEqual(product["currencyCode"] as? String, "USD")
      let price = try XCTUnwrap(product["displayPrice"] as? String)
      XCTAssertTrue(price.contains("$"), "the store formats the price: \(price)")
    }
    XCTAssertTrue((byID[monthly]?["displayPrice"] as? String ?? "").contains("2.99"))
    XCTAssertTrue((byID[lifetime]?["displayPrice"] as? String ?? "").contains("29.99"))
    XCTAssertTrue((byID[thanks]?["displayPrice"] as? String ?? "").contains("14.99"))
  }

  // MARK: - One-time purchase

  func testAStoreHoldingNoTransactionCannotSay() async throws {
    // Not "owns nothing": an empty cache looks the same on a buyer's restored phone, and on
    // this store every ending leaves a transaction behind. The app changes nothing on it.
    let json = await billing.entitlementsJSON()
    XCTAssertEqual(try Fixtures.json(json), try Fixtures.json(#"{"kind":"unknown","reason":"noTransactions"}"#))
  }

  func testBuyingLifetimeIsOwnedAtOnceAndForGood() async throws {
    let outcome = try await billing.purchase(lifetime)
    XCTAssertEqual(outcome, "purchased")
    let owned = try await records()
    XCTAssertEqual(owned, [Record(productId: lifetime, status: "active", expiresAtMs: nil, willRenew: nil, verified: true)])
    // A second adapter, as after a restart, reads the same thing from StoreKit's cache.
    await billing.stop()
    billing = StoreKitBilling()
    let again = try await records()
    XCTAssertEqual(again, owned)
  }

  func testARefundedLifetimeReadsAsRevoked() async throws {
    _ = try await billing.purchase(thanks)
    try session.refundTransaction(identifier: try transactionID(of: thanks))
    try await eventually("the refund reaches StoreKit") { try await self.statuses()[self.thanks] == "revoked" }
  }

  func testAProductZeroDoesNotSellCannotBeBought() async throws {
    let outcome = try await billing.purchase("zero_pro_gold")
    XCTAssertEqual(outcome, "unavailable")
  }

  // MARK: - Subscription

  func testANewSubscriberStartsInTheFreeTrialAndWillRenew() async throws {
    let before = Int64(Date().timeIntervalSince1970 * 1000)
    let outcome = try await billing.purchase(monthly)
    XCTAssertEqual(outcome, "purchased")
    let held = try await records()
    let record = try XCTUnwrap(held.first)
    XCTAssertEqual(record.productId, monthly)
    XCTAssertEqual(record.status, "trial")
    XCTAssertEqual(record.willRenew, true)
    XCTAssertEqual(record.verified, true)
    XCTAssertGreaterThan(try XCTUnwrap(record.expiresAtMs), before, "the trial ends in the future")
  }

  func testTurningRenewalOffIsReportedAndProStaysOnUntilThePeriodEnds() async throws {
    _ = try await billing.purchase(monthly)
    try session.disableAutoRenewForTransaction(identifier: try transactionID(of: monthly))
    try await eventually("renewal is off") { try await self.records().first?.willRenew == false }
    let status = try await statuses()[monthly]
    XCTAssertEqual(status, "trial")
  }

  func testAChangeOfSubscriptionStatusIsReportedThoughItIsNoTransaction() async throws {
    _ = try await billing.purchase(monthly)
    let changed = expectation(description: "the store reported a change")
    changed.assertForOverFulfill = false
    await billing.setChangeHandler { changed.fulfill() }
    try session.disableAutoRenewForTransaction(identifier: try transactionID(of: monthly))
    await fulfillment(of: [changed], timeout: 30)
  }

  func testAnExpiredSubscriptionReadsAsExpired() async throws {
    _ = try await billing.purchase(monthly)
    try session.expireSubscription(productIdentifier: monthly)
    try await eventually("the subscription has expired") { try await self.statuses()[self.monthly] == "expired" }
  }

  func testARefundedSubscriptionReadsAsRevoked() async throws {
    _ = try await billing.purchase(monthly)
    try session.refundTransaction(identifier: try transactionID(of: monthly))
    try await eventually("the refund reaches StoreKit") { try await self.statuses()[self.monthly] == "revoked" }
  }

  func testAFailedRenewalWithGraceReadsAsGrace() async throws {
    session.billingGracePeriodIsEnabled = true
    session.shouldEnterBillingRetryOnRenewal = true
    _ = try await billing.purchase(monthly)
    try session.forceRenewalOfSubscription(productIdentifier: monthly)
    try await eventually("the subscription is in its grace period") { try await self.statuses()[self.monthly] == "grace" }
  }

  func testAFailedRenewalWithoutGraceReadsAsOnHoldAndComesBackWhenThePaymentIsFixed() async throws {
    session.billingGracePeriodIsEnabled = false
    session.shouldEnterBillingRetryOnRenewal = true
    _ = try await billing.purchase(monthly)
    try session.forceRenewalOfSubscription(productIdentifier: monthly)
    try await eventually("the subscription is in billing retry") { try await self.statuses()[self.monthly] == "onHold" }
    session.shouldEnterBillingRetryOnRenewal = false
    try session.resolveIssueForTransaction(identifier: try transactionID(of: monthly))
    try await eventually("the payment went through") {
      let status = try await self.statuses()[self.monthly]
      return status == "active" || status == "trial"
    }
  }

  func testARenewedSubscriptionIsPaidNotATrial() async throws {
    _ = try await billing.purchase(monthly)
    try session.forceRenewalOfSubscription(productIdentifier: monthly)
    try await eventually("the first paid period has begun") { try await self.statuses()[self.monthly] == "active" }
  }

  func testASubscriberWhoBuysLifetimeHoldsBoth() async throws {
    _ = try await billing.purchase(monthly)
    _ = try await billing.purchase(lifetime)
    let held = try await statuses()
    XCTAssertEqual(held, [monthly: "trial", lifetime: "active"])
  }

  // MARK: - Waiting for approval

  func testAskToBuyIsPendingUntilApprovedThenOwned() async throws {
    session.askToBuyEnabled = true
    let changed = expectation(description: "the store reported a change")
    changed.assertForOverFulfill = false
    await billing.setChangeHandler { changed.fulfill() }
    await billing.start()

    let outcome = try await billing.purchase(lifetime)
    XCTAssertEqual(outcome, "pending")
    let waiting = try await statuses()
    XCTAssertEqual(waiting, [lifetime: "pending"], "paid for but not cleared: not owned")

    try session.approveAskToBuyTransaction(identifier: try transactionID(of: lifetime))
    await fulfillment(of: [changed], timeout: 30)
    try await eventually("the approved purchase is owned") { try await self.statuses()[self.lifetime] == "active" }
  }

  // A declined Ask to Buy is not tested here: Xcode 27.2's test store lists a declined purchase
  // in `Transaction.currentEntitlements` as if it had completed, which the App Store does not do
  // (a declined request leaves no transaction). Nothing the adapter reads can tell the two apart
  // in this environment, so the case is covered by the mapping (no entitlement, no record) and
  // by the sandbox walk in the release checklist.

  // MARK: - Outside the app

  func testAPurchaseMadeOutsideTheAppIsReportedAndOwned() async throws {
    let changed = expectation(description: "the store reported a change")
    changed.assertForOverFulfill = false
    await billing.setChangeHandler { changed.fulfill() }
    await billing.start()
    // As from the App Store itself, or another device.
    _ = try await session.buyProduct(identifier: lifetime, options: [])
    await fulfillment(of: [changed], timeout: 30)
    try await eventually("the purchase is owned") { try await self.statuses()[self.lifetime] == "active" }
  }

  func testStartingTwiceListensOnce() async throws {
    // Asked of the code, not counted from the store: how many times the test store reports one
    // purchase, and how soon, is its own business (a cold simulator has been seen to take 10 s,
    // and an update for one test's purchase to arrive during the next test).
    let again = await billing.start()
    XCTAssertFalse(again, "set-up has started it already")
    let third = await billing.start()
    XCTAssertFalse(third)
  }

  // MARK: - The rest

  // The test store's sync neither prompts nor fails, so this shows only that Restore answers
  // with what is owned; a cancelled or failed sync is left to the sandbox walk.
  func testRestoreAnswersWithWhatIsOwned() async throws {
    _ = try await billing.purchase(lifetime)
    let json = await billing.restoreJSON()
    let answer = try XCTUnwrap(try Fixtures.json(json) as? [String: Any])
    XCTAssertEqual(answer["kind"] as? String, "known")
    XCTAssertEqual((answer["entitlements"] as? [[String: Any]])?.first?["productId"] as? String, lifetime)
  }

  func testTheOriginalInstallIsAlwaysOneOfTheTwoShapesTheAppReads() async throws {
    let json = await billing.originalInstallJSON()
    let install = try XCTUnwrap(try Fixtures.json(json) as? [String: Any])
    let signed = try XCTUnwrap(install["signed"] as? Bool)
    if signed {
      XCTAssertGreaterThanOrEqual(try XCTUnwrap((install["build"] as? NSNumber)?.intValue), 0)
    } else {
      XCTAssertTrue(install["build"] is NSNull)
    }
  }
}
