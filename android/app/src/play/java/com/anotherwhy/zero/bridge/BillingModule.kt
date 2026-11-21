package com.anotherwhy.zero.bridge

import android.content.Intent
import androidx.core.net.toUri
import com.anotherwhy.zero.billing.GooglePlayStore
import com.anotherwhy.zero.billing.PlayBilling
import com.anotherwhy.zero.billing.PlayCatalogue
import com.anotherwhy.zero.billing.PurchaseVerifier
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.UiThreadUtil

/**
 * NativeBilling on Google Play (3.0, play flavour). Glue only: every call
 * hops to the main thread, where [PlayBilling] lives, and every promise is
 * settled exactly once. The foss flavour has a twin of this class that
 * answers "no store" and links no Google code.
 */
class BillingModule(context: ReactApplicationContext) : NativeBillingSpec(context) {

  private val changed: () -> Unit = { emitOnEntitlementsChanged() }

  init {
    UiThreadUtil.runOnUiThread { billing(context).listen(changed) }
  }

  private fun onMain(work: (PlayBilling) -> Unit) {
    UiThreadUtil.runOnUiThread { work(billing(reactApplicationContext)) }
  }

  override fun isAvailable(promise: Promise) = onMain { it.isAvailable(promise::resolve) }

  override fun getProducts(ids: ReadableArray, promise: Promise) = onMain {
    val wanted = (0 until ids.size()).mapNotNull(ids::getString)
    it.products(wanted, promise::resolve) { reason -> promise.reject("billing", reason) }
  }

  override fun purchase(productId: String, offerToken: String, promise: Promise) = onMain {
    it.purchase(reactApplicationContext.currentActivity, productId, offerToken, promise::resolve)
  }

  override fun getEntitlements(promise: Promise) = onMain { it.entitlements(promise::resolve) }

  /** Play has no separate restore: the query already answers for the Google account on this phone. */
  override fun restore(promise: Promise) = getEntitlements(promise)

  override fun openManageSubscriptions(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      try {
        val context = reactApplicationContext
        // Google's documented deep link to one subscription; the Play Store app opens it.
        val page =
            "https://play.google.com/store/account/subscriptions"
                .toUri()
                .buildUpon()
                .appendQueryParameter("sku", PlayCatalogue.SUBSCRIPTION)
                .appendQueryParameter("package", context.packageName)
                .build()
        val intent = Intent(Intent.ACTION_VIEW, page).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        (context.currentActivity ?: context).startActivity(intent)
        promise.resolve(null)
      } catch (error: RuntimeException) {
        // No app on the phone can open the link.
        promise.reject("billing", error)
      }
    }
  }

  /** Play signs no "first installed version"; the app's own first-seen record stands in (src/platform/firstSeenVersion.ts). */
  override fun getOriginalInstall(promise: Promise) = promise.resolve("""{"signed":false,"build":null}""")

  override fun invalidate() {
    UiThreadUtil.runOnUiThread { shared?.abandon(changed) }
    super.invalidate()
  }

  companion object {
    // One client for the life of the process, whatever happens to the React instance. Main thread only.
    private var shared: PlayBilling? = null

    private fun billing(context: ReactApplicationContext): PlayBilling =
        shared
            ?: PlayBilling(GooglePlayStore(context), PurchaseVerifier(PlayCatalogue.LICENCE_KEY, context.packageName))
                .also { shared = it }
  }
}
