import Foundation
import StoreKit
import UIKit

/// The App Store, read through StoreKit 2 (3.0). It reports what the store
/// says and decides nothing: facts go through BillingAnswer to the app, and
/// src/pro/entitlement.ts decides what they mean.
///
/// Nothing here contacts a server of zero's. StoreKit verifies every
/// transaction on the device and keeps its own cache, which is what these
/// calls read; the app never sees the buyer's name, card or Apple Account.
public actor StoreKitBilling {
  public static let shared = StoreKitBilling()

  /// Purchases that returned `.pending` in this run of the app (Ask to Buy, a
  /// bank's approval). StoreKit gives no way to ask for them later; when one
  /// completes, the transaction arrives through `Transaction.updates`.
  private var pending: Set<String> = []
  private var listener: Task<Void, Never>?
  private var statusListener: Task<Void, Never>?
  private var onChange: (@Sendable () -> Void)?

  public init() {}

  /// Called when StoreKit reports a transaction outside a purchase call, or a change in a subscription's status.
  public func setChangeHandler(_ handler: (@Sendable () -> Void)?) {
    onChange = handler
  }

  /// Starts listening for transactions made outside a purchase call: Ask to
  /// Buy approvals, purchases on another device, offer codes, and anything
  /// left unfinished, which StoreKit delivers once right after launch. Apple
  /// asks for this "as soon as your app launches". Also listens for changes
  /// in a subscription's status (renewal switched off, a failed payment, an
  /// expiry), which are not transactions. Safe to call again.
  @discardableResult
  public func start() -> Bool {
    guard listener == nil else {
      return false
    }
    listener = Task { [weak self] in
      for await result in Transaction.updates {
        guard let self else {
          return
        }
        await self.received(result)
      }
    }
    statusListener = Task { [weak self] in
      for await _ in Product.SubscriptionInfo.Status.updates {
        guard let self else {
          return
        }
        await self.statusChanged()
      }
    }
    return true
  }

  /// Stops listening. The app never does; a test does, so one test's listener cannot take the next one's updates.
  public func stop() {
    listener?.cancel()
    listener = nil
    statusListener?.cancel()
    statusListener = nil
  }

  deinit {
    listener?.cancel()
    statusListener?.cancel()
  }

  private func statusChanged() {
    onChange?()
  }

  private func received(_ result: VerificationResult<Transaction>) async {
    if case .verified(let transaction) = result {
      pending.remove(transaction.productID)
      // Finished only once verified; an unverified one is left for StoreKit to offer again.
      await transaction.finish()
    }
    onChange?()
  }

  // MARK: - What is owned

  /// What StoreKit's cache says about each product zero sells.
  ///
  /// `Transaction.currentEntitlements` is Apple's list of what the customer is entitled to
  /// ("the latest transaction for each product the customer has an entitlement to"; refunded
  /// and revoked products do not appear), and it alone makes a product owned. The latest
  /// transaction and the subscription status add what that list cannot say: a refund, a failed
  /// payment, an expiry, a trial, whether it will renew.
  func facts() async -> [ProductFact] {
    var entitledAndVerified: [String: Bool] = [:]
    for await result in Transaction.currentEntitlements {
      // The values as StoreKit holds them; whether they can be trusted is reported beside them.
      entitledAndVerified[result.unsafePayloadValue.productID] = Self.isVerified(result)
    }
    var facts: [ProductFact] = []
    for productID in BillingCatalogue.all {
      let entitledVerified = entitledAndVerified[productID]
      guard let result = await Transaction.latest(for: productID) else {
        if let verified = entitledVerified {
          facts.append(ProductFact(productId: productID, verified: verified, entitled: true))
        } else if pending.contains(productID) {
          facts.append(ProductFact(productId: productID, pending: true))
        }
        continue
      }
      if entitledVerified == nil, pending.contains(productID) {
        // Bought again after a refund or an expiry, and waiting: the old transaction is still the latest.
        facts.append(ProductFact(productId: productID, pending: true))
      }
      let transaction = result.unsafePayloadValue
      var fact = ProductFact(
        productId: productID, verified: entitledVerified ?? Self.isVerified(result), entitled: entitledVerified != nil,
        revoked: transaction.revocationDate != nil, expiresAtMs: Self.milliseconds(transaction.expirationDate),
        freeTrial: Self.isFreeTrial(transaction))
      if transaction.productType == .autoRenewable, let status = await transaction.subscriptionStatus {
        fact.renewalState = Self.name(of: status.state)
        if case .verified(let renewal) = status.renewalInfo {
          fact.willAutoRenew = renewal.willAutoRenew
        }
        // The status carries the latest transaction of the subscription group: its dates are the current ones.
        if case .verified(let latest) = status.transaction {
          fact.expiresAtMs = Self.milliseconds(latest.expirationDate) ?? fact.expiresAtMs
          fact.freeTrial = Self.isFreeTrial(latest)
          fact.revoked = fact.revoked || latest.revocationDate != nil
        }
      }
      facts.append(fact)
    }
    return facts
  }

  private static func isVerified(_ result: VerificationResult<Transaction>) -> Bool {
    if case .verified = result {
      return true
    }
    return false
  }

  /// The answer the app reads (JSON, src/pro/schema.ts `StoreAnswer`). Read from StoreKit's cache; never throws.
  public func entitlementsJSON() async -> String {
    BillingAnswer.answer(facts: await facts()).json
  }

  /// Asks the App Store to sync first, then answers. `AppStore.sync()` shows
  /// the system's sign-in, so this runs only from the Restore purchases button.
  public func restoreJSON() async -> String {
    // A cancelled or failed sync changes nothing about what the cache holds, which is still the answer.
    try? await AppStore.sync()
    return await entitlementsJSON()
  }

  // MARK: - Buying

  /// The products as the App Store offers them to this buyer (JSON, `StoreProduct`), in the order asked for.
  public func productsJSON(_ ids: [String]) async throws -> String {
    let wanted = ids.filter(BillingCatalogue.all.contains)
    let loaded = try await Product.products(for: wanted)
    var offered: [OfferedProduct] = []
    for productID in wanted {
      guard let product = loaded.first(where: { $0.id == productID }) else {
        continue
      }
      guard let subscription = product.subscription else {
        offered.append(
          OfferedProduct(
            id: product.id, displayPrice: product.displayPrice, currencyCode: product.priceFormatStyle.currencyCode,
            period: nil, trialDays: nil))
        continue
      }
      // zero sells one subscription, monthly. Anything else is left out rather than shown with the wrong period.
      guard subscription.subscriptionPeriod.unit == .month, subscription.subscriptionPeriod.value == 1 else {
        continue
      }
      var trialDays: Int?
      if let offer = subscription.introductoryOffer, offer.paymentMode == .freeTrial,
        await subscription.isEligibleForIntroOffer
      {
        trialDays = BillingJSON.trialDays(
          unit: Self.name(of: offer.period.unit), value: offer.period.value, count: offer.periodCount)
      }
      offered.append(
        OfferedProduct(
          id: product.id, displayPrice: product.displayPrice, currencyCode: product.priceFormatStyle.currencyCode,
          period: "month", trialDays: trialDays))
    }
    return BillingJSON.products(offered)
  }

  /// Starts a purchase and says how it ended (src/pro/schema.ts `PurchaseOutcome`).
  /// Throws only for a failure the outcome cannot name, so the app can log it.
  public func purchase(_ productID: String) async throws -> String {
    guard BillingCatalogue.all.contains(productID), AppStore.canMakePayments else {
      return "unavailable"
    }
    do {
      guard let product = try await Product.products(for: [productID]).first else {
        return "unavailable"
      }
      switch try await Self.buy(product) {
      case .success(.verified(let transaction)):
        pending.remove(productID)
        await transaction.finish()
        return "purchased"
      case .success(.unverified):
        // Not finished and not granted: StoreKit could not verify it.
        return "failed"
      case .pending:
        pending.insert(productID)
        return "pending"
      case .userCancelled:
        return "cancelled"
      @unknown default:
        return "failed"
      }
    } catch StoreKitError.userCancelled {
      return "cancelled"
    } catch StoreKitError.notAvailableInStorefront {
      return "unavailable"
    } catch Product.PurchaseError.productUnavailable {
      return "unavailable"
    } catch Product.PurchaseError.purchaseNotAllowed {
      return "unavailable"
    }
  }

  /// Apple's guidance for UIKit apps: confirm in the scene (iOS 17+); before that, the original call.
  @MainActor
  private static func buy(_ product: Product) async throws -> Product.PurchaseResult {
    if #available(iOS 17.0, *), let scene = activeScene() {
      return try await product.purchase(confirmIn: scene)
    }
    return try await product.purchase()
  }

  // MARK: - The rest

  /// Opens the App Store's own sheet for viewing or cancelling the subscription.
  @MainActor
  public static func showManageSubscriptions() async throws {
    guard let scene = activeScene() else {
      throw BillingError.noActiveScene
    }
    try await AppStore.showManageSubscriptions(in: scene)
  }

  /// The build this Apple Account first downloaded, when the App Store signs
  /// it (iOS 16+). May need the network and can fail; the app then falls back
  /// to what it recorded itself. Asked for only when the upgrade sheet needs it.
  public func originalInstallJSON() async -> String {
    if #available(iOS 16.0, *) {
      if let result = try? await AppTransaction.shared, case .verified(let app) = result {
        return BillingJSON.originalInstall(signedVersion: app.originalAppVersion)
      }
    }
    return BillingJSON.originalInstall(signedVersion: nil)
  }

  // MARK: - StoreKit values as plain ones

  static func milliseconds(_ date: Date?) -> Int64? {
    date.map { Int64(($0.timeIntervalSince1970 * 1000).rounded()) }
  }

  /// Whether the transaction's period is a free trial. zero's only
  /// introductory offer is the free trial, which is all the older property can say.
  static func isFreeTrial(_ transaction: Transaction) -> Bool {
    if #available(iOS 17.2, *) {
      return transaction.offer?.paymentMode == .freeTrial
    }
    return transaction.offerType == .introductory
  }

  /// The state by the name BillingAnswer knows; a state this build has never heard of keeps its own description.
  static func name(of state: Product.SubscriptionInfo.RenewalState) -> String {
    switch state {
    case .subscribed: return "subscribed"
    case .inGracePeriod: return "inGracePeriod"
    case .inBillingRetryPeriod: return "inBillingRetryPeriod"
    case .expired: return "expired"
    case .revoked: return "revoked"
    default: return "unrecognised(\(state.rawValue))"
    }
  }

  static func name(of unit: Product.SubscriptionPeriod.Unit) -> String {
    switch unit {
    case .day: return "day"
    case .week: return "week"
    case .month: return "month"
    case .year: return "year"
    @unknown default: return "unknown"
    }
  }

  @MainActor
  private static func activeScene() -> UIWindowScene? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    return scenes.first { $0.activationState == .foregroundActive } ?? scenes.first
  }
}

enum BillingError: Error, CustomStringConvertible {
  case noActiveScene

  var description: String {
    switch self {
    case .noActiveScene: return "no window scene to present the App Store sheet in"
    }
  }
}
