package com.anotherwhy.zero.bridge

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/**
 * The app's own Turbo Modules, created lazily: the widget bridge (both
 * platforms have one), the quick-add window (Android only), the store (3.0:
 * `BillingModule` is one class per flavour, Google Play in `play` and "no
 * store" in `foss`), reminders (3.0, P9), the encrypted backup (3.0, P10) and PDF reports (3.0, P12). The iOS-only
 * NativePendingEntries has no Android module, so JS gets null for it here.
 */
class ZeroBridgePackage : BaseReactPackage() {

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
      when (name) {
        NativeWidgetBridgeSpec.NAME -> WidgetBridgeModule(reactContext)
        NativeQuickAddWindowSpec.NAME -> QuickAddWindowModule(reactContext)
        NativeBillingSpec.NAME -> BillingModule(reactContext)
        NativeRemindersSpec.NAME -> RemindersModule(reactContext)
        NativeBackupSpec.NAME -> BackupModule(reactContext)
        NativeReportPdfSpec.NAME -> ReportPdfModule(reactContext)
        else -> null
      }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    listOf(
        NativeWidgetBridgeSpec.NAME,
        NativeQuickAddWindowSpec.NAME,
        NativeBillingSpec.NAME,
        NativeRemindersSpec.NAME,
        NativeBackupSpec.NAME,
        NativeReportPdfSpec.NAME,
    ).associateWith { name ->
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
