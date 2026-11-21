package com.anotherwhy.zero.billing

import org.json.JSONArray
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Which offer zero sells, and how a product is described to the app (3.0). */
class PlayOffersTest {
  private val paid = OfferPhase(99_000_000, "₹99.00", "INR", "P1M", cycleCount = 0, recurring = true)
  private val free = OfferPhase(0, "Free", "INR", "P2W", cycleCount = 1, recurring = false)
  private val basePlan = SubscriptionOffer("monthly", offerId = null, offerToken = "base-token", phases = listOf(paid))
  private val trial = SubscriptionOffer("monthly", offerId = "trial14", offerToken = "trial-token", phases = listOf(free, paid))

  private fun subscription(vararg offers: SubscriptionOffer) = PlayProduct("zero_pro", offers = offers.toList())

  @Test
  fun `the free trial is chosen where Play offers it, the base plan where it does not`() {
    assertEquals(trial, PlayOffers.chosen(listOf(basePlan, trial)))
    // Play returns only the offers this buyer is eligible for: no trial here means none to give.
    assertEquals(basePlan, PlayOffers.chosen(listOf(basePlan)))
  }

  @Test
  fun `an offer of another base plan, or one zero does not know, is never chosen`() {
    val yearly = basePlan.copy(basePlanId = "yearly")
    val winback = trial.copy(offerId = "winback")
    assertNull(PlayOffers.chosen(listOf(yearly)))
    assertNull(PlayOffers.chosen(listOf(winback)))
    assertEquals(basePlan, PlayOffers.chosen(listOf(yearly, winback, basePlan)))
    assertNull(PlayOffers.chosen(emptyList()))
  }

  @Test
  fun `a trial is described with the price that follows it, and its length in days`() {
    assertEquals(
        OfferedProduct("zero_pro", "₹99.00", "INR", period = "month", trialDays = 14, offerToken = "trial-token"),
        PlayOffers.offered(subscription(basePlan, trial)),
    )
    assertEquals(
        OfferedProduct("zero_pro", "₹99.00", "INR", period = "month", trialDays = null, offerToken = "base-token"),
        PlayOffers.offered(subscription(basePlan)),
    )
  }

  @Test
  fun `a subscription that cannot be described truthfully is not offered`() {
    // Not a month: the upgrade sheet says "a month".
    assertNull(PlayOffers.offered(subscription(basePlan.copy(phases = listOf(paid.copy(billingPeriod = "P1Y"))))))
    // No phase that repeats: nothing to call the price.
    assertNull(PlayOffers.offered(subscription(basePlan.copy(phases = listOf(free)))))
    assertNull(PlayOffers.offered(subscription()))
    assertNull(PlayOffers.offered(PlayProduct("zero_pro_gold", oneTimePrice = "₹1.00", oneTimeCurrency = "INR")))
  }

  @Test
  fun `a discounted first month is not called a free trial`() {
    val intro = OfferPhase(49_000_000, "₹49.00", "INR", "P1M", cycleCount = 1, recurring = false)
    val offer = trial.copy(phases = listOf(intro, paid))
    assertEquals(null, PlayOffers.offered(subscription(offer))?.trialDays)
    assertEquals("₹99.00", PlayOffers.offered(subscription(offer))?.displayPrice)
  }

  @Test
  fun `a one-time product carries its price and, where Play gives one, its offer token`() {
    assertEquals(
        OfferedProduct("zero_pro_lifetime", "₹1,199.00", "INR", period = null, trialDays = null, offerToken = "one-time-token"),
        PlayOffers.offered(PlayProduct("zero_pro_lifetime", "₹1,199.00", "INR", "one-time-token")),
    )
    assertEquals(null, PlayOffers.offered(PlayProduct("zero_pro_lifetime", "₹1,199.00", "INR"))?.offerToken)
    assertNull(PlayOffers.offered(PlayProduct("zero_pro_lifetime")))
  }

  @Test
  fun `a period is counted in days`() {
    assertEquals(14, PlayOffers.days("P14D"))
    assertEquals(14, PlayOffers.days("P2W"))
    assertEquals(30, PlayOffers.days("P1M"))
    assertEquals(365, PlayOffers.days("P1Y"))
    for (unreadable in listOf("", "P", "P0D", "P1M2D", "14D", "PT1H", "P-1D")) {
      assertNull(unreadable, PlayOffers.days(unreadable))
    }
  }

  @Test
  fun `products are written in the shape the app reads, in the order it asked, each once`() {
    val json =
        PlayOffers.json(
            listOf("zero_pro_lifetime", "zero_pro_gold", "zero_pro", "zero_pro_lifetime"),
            listOf(subscription(basePlan, trial), PlayProduct("zero_pro_lifetime", "₹1,199.00", "INR")),
        )
    val expected =
        JSONArray(
            """
            [{"id":"zero_pro_lifetime","displayPrice":"₹1,199.00","currencyCode":"INR","period":null,"trialDays":null,"offerToken":null},
             {"id":"zero_pro","displayPrice":"₹99.00","currencyCode":"INR","period":"month","trialDays":14,"offerToken":"trial-token"}]
            """)
    assertEquals(expected.toString(), JSONArray(json).toString())
  }
}
