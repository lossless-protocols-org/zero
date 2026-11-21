package com.anotherwhy.zero.billing

import android.app.Activity

/** How a call to Play ended, reduced to what the app acts on. [name] is Play's own name for it, for Diagnostics. */
data class StoreResult(val code: Code, val name: String) {
  enum class Code {
    OK,
    USER_CANCELED,
    ALREADY_OWNED,
    /** Billing, the product or the feature is not available on this phone or to this account. */
    UNAVAILABLE,
    /** Everything else: disconnected, timed out, a network error inside the Play Store, an error. */
    ERROR,
  }

  val ok: Boolean
    get() = code == Code.OK

  companion object {
    val OK = StoreResult(Code.OK, "OK")

    /** Play's name for "this Play Store is too old for what was asked". */
    const val FEATURE_NOT_SUPPORTED = "FEATURE_NOT_SUPPORTED"
  }
}

enum class ProductType {
  SUBSCRIPTION,
  ONE_TIME,
}

/** A purchase as Play's client returns it (`com.android.billingclient.api.Purchase`). */
data class StorePurchase(
    val productIds: List<String>,
    /** [PlayAnswer.PURCHASED], [PlayAnswer.PENDING], or "unspecified". */
    val state: String,
    val suspended: Boolean,
    val autoRenewing: Boolean,
    val acknowledged: Boolean,
    val token: String,
    val originalJson: String,
    val signature: String,
)

/**
 * Google Play's billing client, as far as zero uses it. The one
 * implementation that talks to Google is [GooglePlayStore]; everything that
 * decides anything is written against this, and tested against a fake.
 *
 * Every callback arrives on the main thread, exactly once.
 */
interface PlayStore {
  /** Called on the main thread when Play reports purchases outside a query: a purchase flow ending, a payment clearing. */
  var onPurchasesUpdated: ((StoreResult, List<StorePurchase>) -> Unit)?

  /** Connects if not connected. Safe to call before every request. */
  fun connect(done: (StoreResult) -> Unit)

  /**
   * What this Google account holds of [type], from the Play Store's own cache.
   * [includeSuspended] also asks for subscriptions that are paused or on hold;
   * a Play Store too old to know the question answers FEATURE_NOT_SUPPORTED.
   */
  fun purchases(type: ProductType, includeSuspended: Boolean, done: (StoreResult, List<StorePurchase>) -> Unit)

  /** The products of [type] among [ids] that Play offers this buyer; one it does not is simply absent. */
  fun products(ids: List<String>, type: ProductType, done: (StoreResult, List<PlayProduct>) -> Unit)

  /**
   * Opens Play's purchase sheet for [productId]. [done] says only whether the
   * sheet opened; how the purchase ends arrives through [onPurchasesUpdated].
   */
  fun launch(activity: Activity, productId: String, type: ProductType, offerToken: String?, done: (StoreResult) -> Unit)

  /** Tells Play the purchase was delivered. Without it Play refunds the purchase after three days. */
  fun acknowledge(token: String, done: (StoreResult) -> Unit)
}
