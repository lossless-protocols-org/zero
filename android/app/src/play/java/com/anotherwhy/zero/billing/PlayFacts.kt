package com.anotherwhy.zero.billing

import org.json.JSONArray
import org.json.JSONObject

/**
 * One product of one purchase, as Google Play's client reports it
 * (`BillingClient.queryPurchasesAsync`), reduced to what the answer needs.
 *
 * Play's client says less than the App Store: there is no end date, a free
 * trial and a billing grace period both read as an ordinary active
 * subscription, and a purchase that was refunded, revoked or ran out is simply
 * no longer returned.
 */
data class PurchaseFact(
    val productId: String,
    /** `Purchase.getPurchaseState()`: "purchased", "pending", or "unspecified". */
    val purchaseState: String,
    /** `Purchase.isSuspended()`: paused by the user, or on hold after a failed renewal. No access. */
    val suspended: Boolean = false,
    /** `Purchase.isAutoRenewing()`. */
    val autoRenewing: Boolean = false,
    /** The signature over the purchase data checks out against the app's licence key, for this app. */
    val verified: Boolean = true,
) {
  companion object {
    fun fromJson(json: JSONObject) =
        PurchaseFact(
            productId = json.getString("productId"),
            purchaseState = json.getString("purchaseState"),
            suspended = json.getBoolean("suspended"),
            autoRenewing = json.getBoolean("autoRenewing"),
            verified = json.getBoolean("verified"),
        )
  }
}

/** One thing the store reports about one product (src/pro/schema.ts `StoreRecord`). */
data class StoreRecord(
    val productId: String,
    val status: String,
    val willRenew: Boolean?,
    val verified: Boolean,
)

/** The store's answer (src/pro/schema.ts `StoreAnswer`): everything it knows, or that it cannot say. */
sealed interface StoreAnswer {
  data class Known(val records: List<StoreRecord>) : StoreAnswer

  data class Unknown(val reason: String) : StoreAnswer

  /** The JSON the app parses. Every key is always present: an absent value is `null`, never a missing key. */
  val json: String
    get() =
        when (this) {
          is Known ->
              JSONObject()
                  .put("kind", "known")
                  .put(
                      "entitlements",
                      JSONArray(
                          records.map { record ->
                            JSONObject()
                                .put("productId", record.productId)
                                .put("status", record.status)
                                // Play's client reports no end date.
                                .put("expiresAtMs", JSONObject.NULL)
                                .put("willRenew", record.willRenew ?: JSONObject.NULL)
                                .put("verified", record.verified)
                          }))
          is Unknown -> JSONObject().put("kind", "unknown").put("reason", reason)
        }.toString()
}

/**
 * Play facts to the answer. The store reports; it decides nothing: what an
 * answer means for Pro is src/pro/entitlement.ts, on both platforms.
 */
object PlayAnswer {
  const val PURCHASED = "purchased"
  const val PENDING = "pending"

  /**
   * [facts] is everything both queries returned, after both succeeded. An
   * empty list is an answer here, unlike on the App Store: on Play, "no longer
   * returned" is the only way a refund or an expiry shows.
   */
  fun answer(facts: List<PurchaseFact>): StoreAnswer {
    val sold = facts.filter { it.productId in PlayCatalogue.all }
    // A purchase stops "waiting" once the same product is also returned as paid for.
    val owned = sold.filter { it.purchaseState == PURCHASED && !it.suspended }.map { it.productId }.toSet()
    val records =
        sold.mapNotNull { fact ->
          val subscription = fact.productId in PlayCatalogue.subscriptions
          val willRenew = if (subscription) fact.autoRenewing else null
          when (fact.purchaseState) {
            PENDING ->
                // Paid for but not cleared (cash at a shop, a bank's approval): never owned yet.
                if (fact.productId in owned) null
                else StoreRecord(fact.productId, "pending", willRenew = null, verified = fact.verified)
            PURCHASED ->
                StoreRecord(
                    fact.productId,
                    // Suspended: the user paused it, or a renewal failed and the grace ran out.
                    status = if (subscription && fact.suspended) "onHold" else "active",
                    willRenew = willRenew,
                    verified = fact.verified,
                )
            // A state this build does not know: passed on as unreadable, which the app neither
            // grants nor ends Pro on, while the other products in the answer still count.
            else -> StoreRecord(fact.productId, "active", willRenew = willRenew, verified = false)
          }
        }
    return StoreAnswer.Known(records)
  }
}
