package com.anotherwhy.zero

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.internal.featureflags.ReactNativeFeatureFlags
import com.facebook.react.internal.featureflags.ReactNativeFeatureFlagsOverrides_RNOSS_Stable_Android
import com.facebook.react.internal.featureflags.ReactNativeFeatureFlagsProvider
import com.anotherwhy.zero.bridge.ZeroBridgePackage
import com.anotherwhy.zero.widget.ZeroWidgetProvider

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(ZeroBridgePackage()) // the widget bridge and the quick-add window (app code, not a library)
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
    // zero runs two activities on its one React host (MainActivity and the
    // quick-add sheet), and React Native's check that the activity pausing is
    // the one it tracks as current throws, crashing a release build: seen
    // twice in testing (Moto and emulator, 2026-11-08/09), never reproduced
    // on purpose. RN's own switch for this logs instead of throwing; the
    // lifecycle still moves to paused. The same flags as loadReactNative set
    // (stable), this one changed: it is read only when an activity pauses,
    // after start-up, so nothing read so far changes value.
    ReactNativeFeatureFlags.dangerouslyForceOverride(ZeroFeatureFlags)
    // After a reboot the midnight alarm is gone until something redraws the
    // widget; launchers send APPWIDGET_UPDATE at boot, but not all of them.
    // Any start of the app re-arms it, so the date rolls over on time
    // (audit 2026-11-08 §6.4). Cheap: nothing happens without a placed widget.
    ZeroWidgetProvider.rearmMidnight(this)
  }
}

/** React Native's stable flags, with the pause check logging instead of throwing (see onCreate). */
internal object ZeroFeatureFlags :
    ReactNativeFeatureFlagsProvider by ReactNativeFeatureFlagsOverrides_RNOSS_Stable_Android() {
  override fun skipActivityIdentityAssertionOnHostPause(): Boolean = true
}
