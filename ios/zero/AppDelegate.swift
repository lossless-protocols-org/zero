import UIKit

/// Process-level delegate only. Under the UIScene life cycle (required by the
/// iOS 27 SDK) the window and the React Native start-up live in
/// `SceneDelegate.swift`; the scene configuration is declared in Info.plist
/// (`UIApplicationSceneManifest` → "Default Configuration").
@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Apple asks for the StoreKit transaction listener "as soon as your app launches": a
    // purchase approved or made elsewhere, or left unfinished, is delivered once, right now.
    // React Native starts later (SceneDelegate) and asks the store itself when it does.
    ZeroBillingStore.start()
    return true
  }
}
