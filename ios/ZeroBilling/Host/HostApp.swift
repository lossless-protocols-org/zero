import SwiftUI

/// The smallest app that can host the billing tests. StoreKit Test needs a
/// real app around it: in a bare test bundle the test store offers no products
/// and every purchase fails as "not entitled". Nothing here ships.
@main
struct ZeroBillingHostApp: App {
  var body: some Scene {
    WindowGroup {
      Text("zero billing test host")
    }
  }
}
