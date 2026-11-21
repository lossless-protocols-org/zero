import Foundation
import StoreKit

/// What the JS bridge (ios/zero/Billing/ZeroBilling.mm) calls (3.0): the
/// Objective-C face of StoreKitBilling. Every call answers through its
/// completion block exactly once; none throws.
///
/// The blocks carry JSON text, or an outcome word, and where something can go
/// wrong a second, optional message. The message is for the app's error log:
/// it describes the failure and never holds anything about the buyer.
@objc(ZeroBillingStore)
public final class ZeroBillingStore: NSObject {
  /// Starts the transaction listener. Called at launch (AppDelegate), before React Native exists.
  @objc public static func start() {
    Task {
      await StoreKitBilling.shared.start()
    }
  }

  /// `handler` runs whenever StoreKit reports a transaction outside a purchase call; nil stops it.
  @objc public static func setChangeHandler(_ handler: (@Sendable () -> Void)?) {
    Task {
      await StoreKitBilling.shared.setChangeHandler(handler)
    }
  }

  @objc public static func isAvailable(_ completion: @escaping @Sendable (Bool) -> Void) {
    completion(AppStore.canMakePayments)
  }

  @objc public static func getProducts(
    _ ids: [String], completion: @escaping @Sendable (_ json: String?, _ failure: String?) -> Void
  ) {
    Task {
      do {
        completion(try await StoreKitBilling.shared.productsJSON(ids), nil)
      } catch {
        completion(nil, String(describing: error))
      }
    }
  }

  @objc public static func purchase(
    _ productId: String, completion: @escaping @Sendable (_ outcome: String?, _ failure: String?) -> Void
  ) {
    Task {
      do {
        completion(try await StoreKitBilling.shared.purchase(productId), nil)
      } catch {
        completion(nil, String(describing: error))
      }
    }
  }

  @objc public static func getEntitlements(_ completion: @escaping @Sendable (String) -> Void) {
    Task {
      completion(await StoreKitBilling.shared.entitlementsJSON())
    }
  }

  @objc public static func restore(_ completion: @escaping @Sendable (String) -> Void) {
    Task {
      completion(await StoreKitBilling.shared.restoreJSON())
    }
  }

  @objc public static func openManageSubscriptions(_ completion: @escaping @Sendable (_ failure: String?) -> Void) {
    Task {
      do {
        try await StoreKitBilling.showManageSubscriptions()
        completion(nil)
      } catch {
        completion(String(describing: error))
      }
    }
  }

  @objc public static func getOriginalInstall(_ completion: @escaping @Sendable (String) -> Void) {
    Task {
      completion(await StoreKitBilling.shared.originalInstallJSON())
    }
  }
}
