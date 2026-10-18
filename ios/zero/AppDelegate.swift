import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: RCTAppDelegate {
  /// Kept for `SceneDelegate`, which starts React Native once UIKit hands it a
  /// window scene; `RCTReactNativeFactory` wants the launch options at that point.
  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?

  override func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
    self.moduleName = "zero"
    self.dependencyProvider = RCTAppDependencyProvider()
    self.launchOptions = launchOptions

    // You can add your custom initial props in the dictionary below.
    // They will be passed down to the ViewController used by React Native.
    self.initialProps = [:]

    // The window now belongs to the scene (see SceneDelegate / Info.plist
    // UIApplicationSceneManifest); a window created here without a
    // UIWindowScene would never be shown under the UIScene life cycle.
    self.automaticallyLoadReactNativeWindow = false

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // MARK: UISceneSession Lifecycle

  override func application(
    _ application: UIApplication,
    configurationForConnecting connectingSceneSession: UISceneSession,
    options: UIScene.ConnectionOptions
  ) -> UISceneConfiguration {
    // Resolves to the "Default Configuration" entry in Info.plist, which names SceneDelegate.
    UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
  }

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
