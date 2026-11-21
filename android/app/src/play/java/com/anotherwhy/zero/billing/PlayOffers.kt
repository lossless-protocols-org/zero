package com.anotherwhy.zero.billing

import org.json.JSONArray
import org.json.JSONObject

/** One pricing phase of a subscription offer (`ProductDetails.PricingPhase`). */
data class OfferPhase(
    val priceMicros: Long,
    val formattedPrice: String,
    val currencyCode: String,
    /** ISO 8601, as Play gives it: "P1M", "P2W", "P14D". */
    val billingPeriod: String,
    val cycleCount: Int,
    /** True for the phase that repeats until cancelled (`RecurrenceMode.INFINITE_RECURRING`). */
    val recurring: Boolean,
)

/** One way to buy a subscription (`ProductDetails.SubscriptionOfferDetails`). */
data class SubscriptionOffer(
    val basePlanId: String,
    /** Null for the base plan itself. */
    val offerId: String?,
    val offerToken: String,
    val phases: List<OfferPhase>,
)

/** A product as Play describes it to this buyer, reduced to what the app shows and buys. */
data class PlayProduct(
    val productId: String,
    /** One-time products: the price, and the token of the offer to buy (null on a Play Store too old to give one). */
    val oneTimePrice: String? = null,
    val oneTimeCurrency: String? = null,
    val oneTimeOfferToken: String? = null,
    /** Subscriptions: every offer this buyer is eligible for. */
    val offers: List<SubscriptionOffer> = emptyList(),
)

/** A product as offered to this buyer (src/pro/schema.ts `StoreProduct`). */
data class OfferedProduct(
    val id: String,
    val displayPrice: String,
    val currencyCode: String,
    val period: String?,
    val trialDays: Int?,
    val offerToken: String?,
)

object PlayOffers {
  /**
   * The offer zero sells: the free trial on the monthly base plan where Play
   * says this buyer is eligible for it (Play returns only eligible offers),
   * otherwise the base plan itself. Null when the monthly plan is not on offer.
   */
  fun chosen(offers: List<SubscriptionOffer>): SubscriptionOffer? {
    val monthly = offers.filter { it.basePlanId == PlayCatalogue.BASE_PLAN }
    return monthly.firstOrNull { it.offerId == PlayCatalogue.TRIAL_OFFER } ?: monthly.firstOrNull { it.offerId == null }
  }

  /** Days in an ISO 8601 period of one unit ("P14D", "P2W", "P1M", "P1Y"), or null for anything else. */
  fun days(period: String): Int? {
    val match = Regex("^P(\\d+)([DWMY])$").matchEntire(period) ?: return null
    val count = match.groupValues[1].toIntOrNull() ?: return null
    val unit =
        when (match.groupValues[2]) {
          "D" -> 1
          "W" -> 7
          "M" -> 30
          else -> 365
        }
    return (count * unit).takeIf { it > 0 }
  }

  /** What the app is told about a product, or null when it cannot be described truthfully (so it is not offered). */
  fun offered(product: PlayProduct): OfferedProduct? {
    if (product.productId in PlayCatalogue.lifetime) {
      val price = product.oneTimePrice ?: return null
      val currency = product.oneTimeCurrency ?: return null
      return OfferedProduct(product.productId, price, currency, period = null, trialDays = null, offerToken = product.oneTimeOfferToken)
    }
    if (product.productId !in PlayCatalogue.subscriptions) return null
    val offer = chosen(product.offers) ?: return null
    // What the buyer pays once any introduction is over: the phase that repeats.
    val paid = offer.phases.lastOrNull { it.recurring } ?: return null
    // The app says "a month" on the upgrade sheet; a plan of another length is not what it describes.
    if (paid.billingPeriod != "P1M") return null
    val free = offer.phases.firstOrNull()?.takeIf { it.priceMicros == 0L && !it.recurring }
    val trialDays = free?.let { phase -> days(phase.billingPeriod)?.let { it * phase.cycleCount.coerceAtLeast(1) } }
    return OfferedProduct(product.productId, paid.formattedPrice, paid.currencyCode, period = "month", trialDays = trialDays, offerToken = offer.offerToken)
  }

  /** The JSON the app parses, in the order the app asked. Every key is always present. */
  fun json(ids: List<String>, products: List<PlayProduct>): String {
    val byId = products.mapNotNull(::offered).associateBy { it.id }
    return JSONArray(
            ids.distinct().mapNotNull(byId::get).map { product ->
              JSONObject()
                  .put("id", product.id)
                  .put("displayPrice", product.displayPrice)
                  .put("currencyCode", product.currencyCode)
                  .put("period", product.period ?: JSONObject.NULL)
                  .put("trialDays", product.trialDays ?: JSONObject.NULL)
                  .put("offerToken", product.offerToken ?: JSONObject.NULL)
            })
        .toString()
  }
}
