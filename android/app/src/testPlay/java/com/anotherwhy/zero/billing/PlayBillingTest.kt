package com.anotherwhy.zero.billing

import android.app.Activity
import android.util.Base64
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.Signature
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner

/** Google Play as a script: what each call answers, and a record of what was asked of it. */
private class FakePlayStore : PlayStore {
  override var onPurchasesUpdated: ((StoreResult, List<StorePurchase>) -> Unit)? = null

  var connectResult = StoreResult.OK
  /** When set, `connect` answers only once [releaseConnect] is called. */
  var holdConnect = false
  private val held = mutableListOf<(StoreResult) -> Unit>()
  val purchaseResults = mutableMapOf(ProductType.SUBSCRIPTION to StoreResult.OK, ProductType.ONE_TIME to StoreResult.OK)
  val owned = mutableMapOf<ProductType, List<StorePurchase>>()
  var productsResult = StoreResult.OK
  var offered = listOf<PlayProduct>()
  var launchResult = StoreResult.OK

  val calls = mutableListOf<String>()
  val acknowledged = mutableListOf<String>()

  override fun connect(done: (StoreResult) -> Unit) {
    calls += "connect"
    if (holdConnect) held += done else done(connectResult)
  }

  fun releaseConnect() {
    val waiting = held.toList()
    held.clear()
    waiting.forEach { it(connectResult) }
  }

  /** A Play Store whose billing service predates suspended subscriptions refuses a query that asks for them. */
  var knowsSuspended = true

  override fun purchases(type: ProductType, includeSuspended: Boolean, done: (StoreResult, List<StorePurchase>) -> Unit) {
    calls += "purchases $type" + if (includeSuspended) " with suspended" else ""
    if (includeSuspended && !knowsSuspended) {
      return done(StoreResult(StoreResult.Code.UNAVAILABLE, StoreResult.FEATURE_NOT_SUPPORTED), emptyList())
    }
    // Without the question, a suspended subscription is simply not returned.
    done(purchaseResults.getValue(type), owned[type].orEmpty().filter { includeSuspended || !it.suspended })
  }

  override fun products(ids: List<String>, type: ProductType, done: (StoreResult, List<PlayProduct>) -> Unit) {
    calls += "products $type $ids"
    done(productsResult, offered.filter { it.productId in ids })
  }

  override fun launch(activity: Activity, productId: String, type: ProductType, offerToken: String?, done: (StoreResult) -> Unit) {
    calls += "launch $productId $type $offerToken"
    done(launchResult)
  }

  override fun acknowledge(token: String, done: (StoreResult) -> Unit) {
    acknowledged += token
    done(StoreResult.OK)
  }

  /** Play reporting how a purchase flow ended, or a change made elsewhere. */
  fun report(result: StoreResult, vararg purchases: StorePurchase) = onPurchasesUpdated?.invoke(result, purchases.toList())
}

/**
 * The rules of the Google Play side (3.0), against a scripted store: what is
 * answered, what is acknowledged, how a purchase ends. Law L3 is the first of
 * them: whatever fails, the answer is "cannot say", never "owns nothing".
 */
@RunWith(RobolectricTestRunner::class)
class PlayBillingTest {
  private val play: KeyPair = KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.generateKeyPair()
  private val licenceKey = Base64.encodeToString(play.public.encoded, Base64.NO_WRAP)
  private val store = FakePlayStore()
  private val billing = PlayBilling(store, PurchaseVerifier(licenceKey, PACKAGE))
  private val activity: Activity = Robolectric.buildActivity(Activity::class.java).get()

  private fun sign(json: String, by: KeyPair = play): String {
    val signature = Signature.getInstance("SHA1withRSA")
    signature.initSign(by.private)
    signature.update(json.toByteArray(Charsets.UTF_8))
    return Base64.encodeToString(signature.sign(), Base64.NO_WRAP)
  }

  private fun purchase(
      productId: String,
      state: String = PlayAnswer.PURCHASED,
      acknowledged: Boolean = false,
      autoRenewing: Boolean = false,
      suspended: Boolean = false,
      signedBy: KeyPair = play,
      packageName: String = PACKAGE,
  ): StorePurchase {
    val token = "token-$productId-$state"
    val json = JSONObject().put("packageName", packageName).put("productId", productId).put("purchaseToken", token).toString()
    return StorePurchase(listOf(productId), state, suspended, autoRenewing, acknowledged, token, json, sign(json, signedBy))
  }

  private fun entitlements(of: PlayBilling = billing): JSONObject {
    var answer: String? = null
    of.entitlements { answer = it }
    return JSONObject(checkNotNull(answer) { "no answer was given" })
  }

  private fun statuses(answer: JSONObject): Map<String, String> {
    val records = answer.getJSONArray("entitlements")
    return (0 until records.length()).associate { records.getJSONObject(it).let { r -> r.getString("productId") to r.getString("status") } }
  }

  private fun buy(productId: String, offerToken: String? = null, from: Activity? = activity): () -> String? {
    var outcome: String? = null
    billing.purchase(from, productId, offerToken) { outcome = it }
    return { outcome }
  }

  // MARK: what is owned

  @Test
  fun `the answer holds what both queries returned`() {
    store.owned[ProductType.SUBSCRIPTION] = listOf(purchase(SUBSCRIPTION, autoRenewing = true, acknowledged = true))
    store.owned[ProductType.ONE_TIME] = listOf(purchase(LIFETIME, acknowledged = true))
    val answer = entitlements()
    assertEquals("known", answer.getString("kind"))
    assertEquals(mapOf(SUBSCRIPTION to "active", LIFETIME to "active"), statuses(answer))
    assertEquals(listOf("connect", "purchases SUBSCRIPTION with suspended", "purchases ONE_TIME"), store.calls)
  }

  @Test
  fun `a Play Store too old to report suspended subscriptions is asked again without them`() {
    // Left as "cannot say", a buyer on such a phone would pay and never get Pro.
    store.knowsSuspended = false
    store.owned[ProductType.SUBSCRIPTION] =
        listOf(purchase(SUBSCRIPTION, autoRenewing = true, acknowledged = true), purchase(SUBSCRIPTION, suspended = true, acknowledged = true))
    store.owned[ProductType.ONE_TIME] = listOf(purchase(LIFETIME, acknowledged = true))
    val answer = entitlements()
    assertEquals("known", answer.getString("kind"))
    // The suspended one is not returned at all: no record, which also means no access.
    assertEquals(2, answer.getJSONArray("entitlements").length())
    assertEquals(mapOf(SUBSCRIPTION to "active", LIFETIME to "active"), statuses(answer))
    assertEquals(
        listOf("connect", "purchases SUBSCRIPTION with suspended", "purchases SUBSCRIPTION", "purchases ONE_TIME"),
        store.calls,
    )
  }

  @Test
  fun `a suspended subscription reads as on hold where Play can say`() {
    store.owned[ProductType.SUBSCRIPTION] = listOf(purchase(SUBSCRIPTION, suspended = true, autoRenewing = true, acknowledged = true))
    assertEquals(mapOf(SUBSCRIPTION to "onHold"), statuses(entitlements()))
  }

  @Test
  fun `nothing returned by a store that answered is an answer`() {
    assertEquals("""{"kind":"known","entitlements":[]}""", entitlements().toString())
  }

  @Test
  fun `whatever fails, the answer is that the store cannot say`() {
    val failures =
        listOf(
            StoreResult(StoreResult.Code.UNAVAILABLE, "BILLING_UNAVAILABLE"),
            StoreResult(StoreResult.Code.ERROR, "SERVICE_DISCONNECTED"),
            StoreResult(StoreResult.Code.ERROR, "NETWORK_ERROR"),
            StoreResult(StoreResult.Code.USER_CANCELED, "USER_CANCELED"),
            StoreResult(StoreResult.Code.ALREADY_OWNED, "ITEM_ALREADY_OWNED"),
            // Refused for a reason other than the suspended-subscriptions question: asked once, not twice.
            StoreResult(StoreResult.Code.UNAVAILABLE, "ITEM_UNAVAILABLE"),
        )
    val stages: List<(FakePlayStore, StoreResult) -> Unit> =
        listOf(
            { fake, result -> fake.connectResult = result },
            { fake, result -> fake.purchaseResults[ProductType.SUBSCRIPTION] = result },
            { fake, result -> fake.purchaseResults[ProductType.ONE_TIME] = result },
        )
    for (stage in stages) {
      for (failure in failures) {
        val fake = FakePlayStore()
        // A lifetime purchase the other query would have returned: half an answer must not be read as all of it.
        fake.owned[ProductType.ONE_TIME] = listOf(purchase(LIFETIME, acknowledged = true))
        fake.owned[ProductType.SUBSCRIPTION] = listOf(purchase(SUBSCRIPTION, acknowledged = true))
        stage(fake, failure)
        val answer = entitlements(PlayBilling(fake, PurchaseVerifier(licenceKey, PACKAGE)))
        assertEquals("""{"kind":"unknown","reason":"${failure.name}"}""", answer.toString())
      }
    }
  }

  @Test
  fun `a build with no licence key cannot say, and asks Play nothing`() {
    val keyless = PlayBilling(store, PurchaseVerifier("", PACKAGE))
    assertEquals("""{"kind":"unknown","reason":"noLicenceKey"}""", entitlements(keyless).toString())
    var available: Boolean? = null
    keyless.isAvailable { available = it }
    assertEquals(false, available)
    var products: String? = null
    keyless.products(listOf(LIFETIME), { products = it }) { throw AssertionError(it) }
    assertEquals("[]", products)
    var outcome: String? = null
    keyless.purchase(activity, LIFETIME, null) { outcome = it }
    assertEquals("unavailable", outcome)
    assertEquals(emptyList<String>(), store.calls)
  }

  @Test
  fun `a purchase Play did not sign for this app is passed on as unverified`() {
    val forger = KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.generateKeyPair()
    store.owned[ProductType.ONE_TIME] = listOf(purchase(LIFETIME, signedBy = forger), purchase(THANKS, packageName = "com.example.other"))
    val records = entitlements().getJSONArray("entitlements")
    assertEquals(2, records.length())
    for (i in 0 until records.length()) {
      assertFalse(records.getJSONObject(i).getBoolean("verified"))
    }
    assertEquals("neither is acknowledged: it was not delivered", emptyList<String>(), store.acknowledged)
  }

  @Test
  fun `the store is available when the key is usable and Play answers`() {
    var available: Boolean? = null
    billing.isAvailable { available = it }
    assertEquals(true, available)
    store.connectResult = StoreResult(StoreResult.Code.UNAVAILABLE, "BILLING_UNAVAILABLE")
    billing.isAvailable { available = it }
    assertEquals(false, available)
  }

  // MARK: acknowledging

  @Test
  fun `every paid, verified, unacknowledged purchase is acknowledged on every query`() {
    store.owned[ProductType.SUBSCRIPTION] = listOf(purchase(SUBSCRIPTION))
    store.owned[ProductType.ONE_TIME] = listOf(purchase(LIFETIME))
    entitlements()
    assertEquals(listOf("token-$SUBSCRIPTION-purchased", "token-$LIFETIME-purchased"), store.acknowledged)
    // Play still reports them unacknowledged (the call may have failed): tried again.
    entitlements()
    assertEquals(4, store.acknowledged.size)
  }

  @Test
  fun `a subscription is acknowledged even when the second query then fails`() {
    store.owned[ProductType.SUBSCRIPTION] = listOf(purchase(SUBSCRIPTION))
    store.purchaseResults[ProductType.ONE_TIME] = StoreResult(StoreResult.Code.ERROR, "ERROR")
    assertEquals("unknown", entitlements().getString("kind"))
    assertEquals(listOf("token-$SUBSCRIPTION-purchased"), store.acknowledged)
  }

  @Test
  fun `never a pending one, an acknowledged one, or one of a product zero does not sell`() {
    store.owned[ProductType.ONE_TIME] =
        listOf(
            purchase(LIFETIME, state = PlayAnswer.PENDING),
            purchase(THANKS, acknowledged = true),
            purchase("zero_pro_gold"),
            purchase(LIFETIME, state = "unspecified"),
        )
    entitlements()
    assertEquals(emptyList<String>(), store.acknowledged)
  }

  // MARK: what is on offer

  @Test
  fun `products are asked for by type, and only the ones zero sells`() {
    store.offered = listOf(PlayProduct(LIFETIME, "₹1,199.00", "INR"))
    var json: String? = null
    billing.products(listOf(LIFETIME, "zero_pro_gold", SUBSCRIPTION), { json = it }) { throw AssertionError(it) }
    assertEquals(listOf("connect", "products SUBSCRIPTION [$SUBSCRIPTION]", "products ONE_TIME [$LIFETIME]"), store.calls)
    val products = JSONArray(json)
    assertEquals(1, products.length())
    assertEquals(LIFETIME, products.getJSONObject(0).getString("id"))
  }

  @Test
  fun `a type with nothing asked for is not queried, and nothing asked for asks nothing`() {
    var json: String? = null
    billing.products(listOf(LIFETIME), { json = it }) { throw AssertionError(it) }
    assertEquals(listOf("connect", "products ONE_TIME [$LIFETIME]"), store.calls)
    store.calls.clear()
    billing.products(listOf("zero_pro_gold"), { json = it }) { throw AssertionError(it) }
    assertEquals("[]", json)
    assertEquals(emptyList<String>(), store.calls)
  }

  @Test
  fun `a failed product query is reported as failed, not as nothing on offer`() {
    var failure: String? = null
    store.productsResult = StoreResult(StoreResult.Code.ERROR, "SERVICE_UNAVAILABLE")
    billing.products(listOf(LIFETIME), { throw AssertionError(it) }) { failure = it }
    assertEquals("SERVICE_UNAVAILABLE", failure)
    failure = null
    store.connectResult = StoreResult(StoreResult.Code.UNAVAILABLE, "BILLING_UNAVAILABLE")
    billing.products(listOf(LIFETIME), { throw AssertionError(it) }) { failure = it }
    assertEquals("BILLING_UNAVAILABLE", failure)
  }

  // MARK: buying

  @Test
  fun `a paid, verified purchase ends as purchased and is acknowledged at once`() {
    val outcome = buy(LIFETIME)
    assertNull("the sheet is open: no outcome yet", outcome())
    assertEquals("launch $LIFETIME ONE_TIME null", store.calls.last())
    store.report(StoreResult.OK, purchase(LIFETIME))
    assertEquals("purchased", outcome())
    assertEquals(listOf("token-$LIFETIME-purchased"), store.acknowledged)
  }

  @Test
  fun `the offer the app chose is the one bought, and an empty token is no token`() {
    buy(SUBSCRIPTION, "trial-token")
    assertEquals("launch $SUBSCRIPTION SUBSCRIPTION trial-token", store.calls.last())
    store.report(StoreResult(StoreResult.Code.USER_CANCELED, "USER_CANCELED"))
    buy(SUBSCRIPTION, "")
    assertEquals("launch $SUBSCRIPTION SUBSCRIPTION null", store.calls.last())
  }

  @Test
  fun `a payment still clearing ends as pending and is not acknowledged`() {
    val outcome = buy(LIFETIME)
    store.report(StoreResult.OK, purchase(LIFETIME, state = PlayAnswer.PENDING))
    assertEquals("pending", outcome())
    assertEquals(emptyList<String>(), store.acknowledged)
  }

  @Test
  fun `a purchase Play did not sign does not end as purchased`() {
    val forger = KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.generateKeyPair()
    val forged = buy(LIFETIME)
    store.report(StoreResult.OK, purchase(LIFETIME, signedBy = forger))
    assertEquals("failed", forged())
  }

  @Test
  fun `news of another product while the sheet is open does not end it`() {
    val outcome = buy(LIFETIME)
    // Another product's payment clearing, or a report with nothing in it: not this sheet's end.
    store.report(StoreResult.OK, purchase(THANKS))
    store.report(StoreResult.OK)
    assertNull(outcome())
    store.report(StoreResult.OK, purchase(LIFETIME))
    assertEquals("purchased", outcome())
  }

  @Test
  fun `each way Play can end the sheet has its outcome`() {
    val outcomes =
        mapOf(
            StoreResult(StoreResult.Code.USER_CANCELED, "USER_CANCELED") to "cancelled",
            StoreResult(StoreResult.Code.ALREADY_OWNED, "ITEM_ALREADY_OWNED") to "alreadyOwned",
            StoreResult(StoreResult.Code.UNAVAILABLE, "ITEM_UNAVAILABLE") to "unavailable",
            StoreResult(StoreResult.Code.ERROR, "NETWORK_ERROR") to "failed",
        )
    for ((result, expected) in outcomes) {
      // Reported when the sheet closes…
      val closed = buy(LIFETIME)
      store.report(result)
      assertEquals(result.name, expected, closed())
      // …or at once, when it never opened…
      store.launchResult = result
      assertEquals(result.name, expected, buy(LIFETIME)())
      store.launchResult = StoreResult.OK
      // …or when Play could not be reached at all.
      store.connectResult = result
      assertEquals(result.name, expected, buy(LIFETIME)())
      store.connectResult = StoreResult.OK
    }
  }

  @Test
  fun `a new request closes one Play never ended, so a lost sheet cannot block buying`() {
    // Play's sheet covers the app: a second request means the first sheet is gone.
    val lost = buy(LIFETIME)
    assertNull(lost())
    val next = buy(THANKS)
    assertEquals("failed", lost())
    assertNull("the new sheet is open", next())
    // A late report about the first product is not this sheet's end.
    store.report(StoreResult.OK, purchase(LIFETIME))
    assertNull(next())
    store.report(StoreResult.OK, purchase(THANKS))
    assertEquals("purchased", next())
  }

  @Test
  fun `only something zero sells, and only from a screen`() {
    assertEquals("unavailable", buy("zero_pro_gold")())
    assertEquals("failed", buy(LIFETIME, from = null)())
    assertTrue(store.calls.none { it.startsWith("launch") })
  }

  @Test
  fun `an outcome is given once, and a later report from Play is only a change`() {
    var outcomes = 0
    var changes = 0
    billing.listen { changes++ }
    billing.purchase(activity, LIFETIME, null) { outcomes++ }
    store.report(StoreResult.OK, purchase(LIFETIME))
    store.report(StoreResult.OK, purchase(LIFETIME))
    assertEquals(1, outcomes)
    assertEquals(2, changes)
  }

  @Test
  fun `when the module goes away an open sheet ends as failed, and one not yet opened never opens`() {
    val mine = {}
    billing.listen(mine)
    val open = buy(LIFETIME)
    billing.abandon(mine)
    assertEquals("failed", open())

    store.holdConnect = true
    val connecting = buy(THANKS)
    billing.abandon(mine)
    assertEquals("failed", connecting())
    store.releaseConnect()
    assertTrue(store.calls.none { it.startsWith("launch $THANKS") })
  }

  @Test
  fun `a module going away silences its own listener, not the one that replaced it`() {
    var old = 0
    var new = 0
    val oldListener = { old++; Unit }
    val newListener = { new++; Unit }
    billing.listen(oldListener)
    // A reload: the new module arrives before the old one is torn down.
    billing.listen(newListener)
    billing.abandon(oldListener)
    store.report(StoreResult.OK, purchase(LIFETIME))
    assertEquals(0, old)
    assertEquals(1, new)
    billing.abandon(newListener)
    store.report(StoreResult.OK, purchase(LIFETIME))
    assertEquals(1, new)
  }

  // MARK: outside the app

  @Test
  fun `a purchase reported with no sheet open is acknowledged and announced`() {
    var changes = 0
    billing.listen { changes++ }
    // A pending payment that cleared, or a purchase made in the Play Store.
    store.report(StoreResult.OK, purchase(LIFETIME))
    assertEquals(1, changes)
    assertEquals(listOf("token-$LIFETIME-purchased"), store.acknowledged)
  }

  private companion object {
    const val PACKAGE = "com.anotherwhy.zero"
    const val SUBSCRIPTION = "zero_pro"
    const val LIFETIME = "zero_pro_lifetime"
    const val THANKS = "zero_pro_lifetime_thanks"
  }
}
