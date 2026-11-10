package com.anotherwhy.zero.bridge

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/**
 * The app's own Turbo Modules, created lazily: the widget bridge (both
 * platforms have one) and the quick-add window (Android only). The iOS-only
 * NativePendingEntries has no Android module, so JS gets null for it here.
 */
class ZeroBridgePackage : BaseReactPackage() {

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
      when (name) {
        NativeWidgetBridgeSpec.NAME -> WidgetBridgeModule(reactContext)
        NativeQuickAddWindowSpec.NAME -> QuickAddWindowModule(reactContext)
        else -> null
      }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    listOf(NativeWidgetBridgeSpec.NAME, NativeQuickAddWindowSpec.NAME).associateWith { name ->
      ReactModuleInfo(
          name = name,
          className = name,
          canOverrideExistingModule = false,
          needsEagerInit = false,
          isCxxModule = false,
          isTurboModule = true,
      )
    }
  }
}
