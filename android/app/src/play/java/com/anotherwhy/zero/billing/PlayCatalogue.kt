package com.anotherwhy.zero.billing

/**
 * What zero sells on Google Play (3.0; handbook plan §4, src/pro/products.ts).
 * The identifiers are permanent: Play never lets one be reused once created.
 */
object PlayCatalogue {
  /** The subscription. Its base plan and its free-trial offer are named below. */
  const val SUBSCRIPTION = "zero_pro"
  const val BASE_PLAN = "monthly"
  const val TRIAL_OFFER = "trial14"

  val subscriptions = listOf(SUBSCRIPTION)
  val lifetime = listOf("zero_pro_lifetime", "zero_pro_lifetime_thanks")
  val all = subscriptions + lifetime

  /**
   * The app's licence key from Play Console (Monetisation setup → Licensing):
   * a Base64 RSA public key, public by nature, with which every purchase's
   * signature is checked on the device. Empty until the owner has the Play
   * listing set up for billing; while it is empty this build cannot tell a
   * real purchase from a forged one, so it sells nothing and reports no
   * purchase as owned (PlayBilling).
   */
  const val LICENCE_KEY = ""
}
