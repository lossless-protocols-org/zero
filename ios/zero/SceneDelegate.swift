import UIKit
import React
import React_RCTAppDelegate

/// UIScene life-cycle entry point.
///
/// Apps built with the iOS 27 SDK must adopt the scene-based life cycle or
/// UIKit refuses to launch them ("UIScene life cycle is required for apps built
/// with this SDK"). React Native 0.86's `RCTAppDelegate` still creates its own
/// window from `didFinishLaunchingWithOptions`, so `AppDelegate` turns that off
/// (`automaticallyLoadReactNativeWindow = false`) and this class creates the
/// window for the scene instead, then starts React Native inside it with the
/// same factory the app delegate owns. Everything else — JS bundle, native
/// modules, Fabric components — is unchanged.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else {
      return
    }
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else {
      return
    }

    let window = UIWindow(windowScene: windowScene)
    appDelegate.reactNativeFactory.startReactNative(
      withModuleName: "zero",
      in: window,
      initialProperties: appDelegate.initialProps,
      launchOptions: appDelegate.launchOptions
    )

    // Some native code (RN's RCTKeyWindow fallback, a few libraries) still reads
    // `UIApplication.shared.delegate.window`; keep it pointing at the real one.
    appDelegate.window = window
    self.window = window
  }
}
