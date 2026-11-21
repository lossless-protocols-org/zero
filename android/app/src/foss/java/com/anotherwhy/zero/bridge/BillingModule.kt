package com.anotherwhy.zero.bridge

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray

/**
 * NativeBilling in the foss flavour (3.0): there is no store. This build
 * links no store library and asks no one; every answer is "nobody to ask",
 * which the app reads as "cannot say" and changes nothing on. The play
 * flavour has the twin of this class that talks to Google Play.
 */
class BillingModule(context: ReactApplicationContext) : NativeBillingSpec(context) {

  override fun isAvailable(promise: Promise) = promise.resolve(false)

  override fun getProducts(ids: ReadableArray, promise: Promise) = promise.resolve("[]")

  override fun purchase(productId: String, offerToken: String, promise: Promise) = promise.resolve("unavailable")

  override fun getEntitlements(promise: Promise) = promise.resolve(NO_STORE)

  override fun restore(promise: Promise) = promise.resolve(NO_STORE)

  override fun openManageSubscriptions(promise: Promise) = promise.resolve(null)

  override fun getOriginalInstall(promise: Promise) = promise.resolve("""{"signed":false,"build":null}""")

  private companion object {
    const val NO_STORE = """{"kind":"unknown","reason":"noStore"}"""
  }
}
