import Foundation

/// What zero sells on the App Store (3.0). The same identifiers as
/// src/pro/products.ts; contracts/billing-scenarios.json pins both sides.
public enum BillingCatalogue {
  public static let subscriptions = ["zero_pro_monthly"]
  public static let lifetime = ["zero_pro_lifetime", "zero_pro_lifetime_thanks"]
  public static let all = subscriptions + lifetime
}

/// What StoreKit says about one product, as plain values. The adapter
/// (StoreKitBilling) fills these in from StoreKit; everything after that is
/// the pure mapping below, tested from the fixture the JS side also reads.
public struct ProductFact: Codable, Equatable, Sendable {
  public var productId: String
  /// StoreKit's own signature check passed (`VerificationResult.verified`).
  public var verified: Bool
  /// The product is in `Transaction.currentEntitlements`: Apple's own list of what the customer
  /// is entitled to (a one-time purchase not refunded; a subscription that is subscribed or in
  /// its grace period). Nothing is reported as owned without it.
  public var entitled: Bool
  /// `Transaction.revocationDate` is set: refunded, or revoked.
  public var revoked: Bool
  /// `Transaction.expirationDate`, for a subscription.
  public var expiresAtMs: Int64?
  /// The current period is the free trial.
  public var freeTrial: Bool
  /// `Product.SubscriptionInfo.RenewalState` by name. Nil for a one-time
  /// purchase, and for a subscription StoreKit has no status for right now.
  public var renewalState: String?
  /// `RenewalInfo.willAutoRenew`, when StoreKit verified the renewal information.
  public var willAutoRenew: Bool?
  /// A purchase that returned `.pending` (Ask to Buy, a bank's approval): no transaction yet.
  public var pending: Bool

  public init(
    productId: String, verified: Bool = true, entitled: Bool = false, revoked: Bool = false,
    expiresAtMs: Int64? = nil, freeTrial: Bool = false, renewalState: String? = nil, willAutoRenew: Bool? = nil,
    pending: Bool = false
  ) {
    self.productId = productId
    self.verified = verified
    self.entitled = entitled
    self.revoked = revoked
    self.expiresAtMs = expiresAtMs
    self.freeTrial = freeTrial
    self.renewalState = renewalState
    self.willAutoRenew = willAutoRenew
    self.pending = pending
  }
}

/// One line of the answer the app reads (src/pro/schema.ts `StoreRecord`).
public struct StoreRecord: Equatable, Sendable {
  public var productId: String
  public var status: String
  public var expiresAtMs: Int64?
  public var willRenew: Bool?
  public var verified: Bool
}

/// The store's answer (src/pro/schema.ts `StoreAnswer`): everything it knows, or that it cannot say.
public enum StoreAnswer: Equatable, Sendable {
  case known([StoreRecord])
  case unknown(reason: String)

  /// The JSON the app parses. Every key is always present: an absent value is `null`, never a missing key.
  public var json: String {
    let object: [String: Any]
    switch self {
    case .known(let records):
      object = [
        "kind": "known",
        "entitlements": records.map { record -> [String: Any] in
          [
            "productId": record.productId,
            "status": record.status,
            "expiresAtMs": record.expiresAtMs.map { NSNumber(value: $0) } ?? NSNull(),
            "willRenew": record.willRenew.map { NSNumber(value: $0) } ?? NSNull(),
            "verified": record.verified,
          ]
        },
      ]
    case .unknown(let reason):
      object = ["kind": "unknown", "reason": reason]
    }
    return BillingJSON.text(object)
  }
}

/// StoreKit facts to the answer. The store reports; it decides nothing: what
/// an answer means for Pro is src/pro/entitlement.ts, on both platforms.
public enum BillingAnswer {
  /// The names of `Product.SubscriptionInfo.RenewalState` this build understands.
  static let statusByRenewalState: [String: String] = [
    "subscribed": "active",
    "inGracePeriod": "grace",
    "inBillingRetryPeriod": "onHold",
    "expired": "expired",
    "revoked": "revoked",
  ]

  /// What the app is told about a product whose facts cannot be read either way: the record
  /// is passed on marked unverified, which the app neither grants nor ends Pro on, while the
  /// other products in the same answer still count.
  private static func unreadable(_ fact: ProductFact, status: String) -> StoreRecord {
    StoreRecord(
      productId: fact.productId, status: status, expiresAtMs: fact.expiresAtMs, willRenew: fact.willAutoRenew, verified: false)
  }

  public static func answer(facts all: [ProductFact]) -> StoreAnswer {
    let facts = all.filter { BillingCatalogue.all.contains($0.productId) }
    guard !facts.isEmpty else {
      // StoreKit holds nothing about any product zero sells. For someone who never bought,
      // that is all there is. For a buyer it is an empty cache (a restored phone that has not
      // reached the App Store yet, a signed-out Apple Account), not an ending: on this store
      // every ending leaves a transaction behind (a refund carries a revocation date, a lapsed
      // subscription its expiry). So it is "cannot say", and the app changes nothing (L3).
      return .unknown(reason: "noTransactions")
    }
    var records: [StoreRecord] = []
    // A purchase stops "waiting" once the store lists the product as owned.
    let owned = Set(facts.filter { !$0.pending && $0.entitled }.map(\.productId))
    for fact in facts {
      let isSubscription = BillingCatalogue.subscriptions.contains(fact.productId)
      if fact.pending {
        if !owned.contains(fact.productId) {
          records.append(StoreRecord(productId: fact.productId, status: "pending", expiresAtMs: nil, willRenew: nil, verified: true))
        }
        continue
      }
      guard isSubscription else {
        // A one-time purchase: taken back, or owned.
        if fact.revoked || fact.entitled {
          records.append(
            StoreRecord(
              productId: fact.productId, status: fact.revoked ? "revoked" : "active", expiresAtMs: nil, willRenew: nil,
              verified: fact.verified))
        } else {
          // A transaction that was not taken back, for a product the store does not list as
          // owned. A one-time purchase never lapses, so the two reads disagree (they are not
          // made at one instant): not owned, and not ended.
          records.append(unreadable(fact, status: "active"))
        }
        continue
      }
      var status: String
      if fact.revoked {
        status = "revoked"
      } else if let state = fact.renewalState {
        if let known = statusByRenewalState[state] {
          status = known
        } else if fact.entitled {
          // A renewal state added after this build shipped. Apple's entitlement list is the
          // authority on who is entitled, and it lists this one.
          status = "active"
        } else {
          // Not listed, in a state this build cannot read: guessing either way is wrong for somebody.
          records.append(unreadable(fact, status: "expired"))
          continue
        }
      } else {
        // No status to be had (StoreKit could not load it). The entitlement list still says
        // whether the cached period counts; when it does not, the app gives a renewing
        // subscription an offline allowance from the cached end date.
        status = fact.entitled ? "active" : "expired"
      }
      if (status == "active" || status == "grace") && !fact.entitled {
        // The status says paid up and the entitlement list does not. Apple's list is the
        // authority on who is entitled, so this is not owned; it is not an ending either.
        records.append(unreadable(fact, status: status))
        continue
      }
      if status == "active" && fact.freeTrial {
        status = "trial"
      }
      records.append(
        StoreRecord(
          productId: fact.productId, status: status, expiresAtMs: fact.expiresAtMs, willRenew: fact.willAutoRenew,
          verified: fact.verified))
    }
    return .known(records)
  }
}

/// A product as offered to this buyer (src/pro/schema.ts `StoreProduct`).
public struct OfferedProduct: Equatable, Sendable {
  public var id: String
  public var displayPrice: String
  public var currencyCode: String
  /// "month", or nil for a one-time purchase.
  public var period: String?
  public var trialDays: Int?

  public init(id: String, displayPrice: String, currencyCode: String, period: String?, trialDays: Int?) {
    self.id = id
    self.displayPrice = displayPrice
    self.currencyCode = currencyCode
    self.period = period
    self.trialDays = trialDays
  }
}

public enum BillingJSON {
  static func text(_ object: Any) -> String {
    // The objects built in this file hold only strings, numbers, booleans, nulls, arrays and dictionaries.
    let data = (try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])) ?? Data("null".utf8)
    return String(decoding: data, as: UTF8.self)
  }

  public static func products(_ products: [OfferedProduct]) -> String {
    text(
      products.map { product -> [String: Any] in
        [
          "id": product.id,
          "displayPrice": product.displayPrice,
          "currencyCode": product.currencyCode,
          "period": product.period ?? NSNull(),
          "trialDays": product.trialDays.map { NSNumber(value: $0) } ?? NSNull(),
          // Google Play's offer token; the App Store has none.
          "offerToken": NSNull(),
        ] as [String: Any]
      })
  }

  /// `signedVersion` is `AppTransaction.originalAppVersion` when StoreKit verified it; nil otherwise.
  /// On iOS that is the build number (`CFBundleVersion`), and "1.0" in the sandbox and in Xcode.
  public static func originalInstall(signedVersion: String?) -> String {
    guard let version = signedVersion,
      let first = version.split(separator: ".", omittingEmptySubsequences: false).first,
      let build = Int(first), build >= 0
    else {
      return text(["signed": false, "build": NSNull()] as [String: Any])
    }
    return text(["signed": true, "build": build] as [String: Any])
  }

  /// Days of a free trial from its period: "2 weeks" is 14.
  public static func trialDays(unit: String, value: Int, count: Int) -> Int? {
    let perUnit: [String: Int] = ["day": 1, "week": 7, "month": 30, "year": 365]
    guard let days = perUnit[unit], value > 0, count > 0 else {
      return nil
    }
    return days * value * count
  }
}
