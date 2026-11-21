package com.anotherwhy.zero.billing

import android.app.Activity

/**
 * Google Play behind the NativeBilling spec (3.0). It reports what Play says
 * and decides nothing about Pro: facts go through [PlayAnswer] to the app, and
 * src/pro/entitlement.ts decides what they mean.
 *
 * Nothing here contacts a server of zero's, and zero itself makes no network
 * call: every request is an inter-process call to the Play Store app, which
 * answers from its own cache.
 *
 * Main thread only: [store] calls back there, and the module calls in there.
 */
class PlayBilling(private val store: PlayStore, private val verifier: PurchaseVerifier) {
  /** Called when Play reports purchases outside a query. */
  var onChange: (() -> Unit)? = null
    private set

  /** Sets who hears of changes: the module of the React instance that is running. */
  fun listen(listener: () -> Unit) {
    onChange = listener
  }

  /** The purchase sheet that is open, if any: its product and where to send the outcome. */
  private var inFlight: Pair<String, (String) -> Unit>? = null

  init {
    store.onPurchasesUpdated = ::purchasesUpdated
  }

  /** True when this build can verify purchases and Play's billing service answers. */
  fun isAvailable(done: (Boolean) -> Unit) {
    if (!verifier.canVerify) return done(false)
    store.connect { done(it.ok) }
  }

  /**
   * The answer the app reads (JSON, src/pro/schema.ts `StoreAnswer`). Any
   * failure, of the connection or of either query, is "cannot say": zero ends
   * Pro only on a positive answer (law L3), and half an answer is not one.
   */
  fun entitlements(done: (String) -> Unit) {
    fun cannotSay(reason: String) = done(StoreAnswer.Unknown(reason).json)
    if (!verifier.canVerify) return cannotSay("noLicenceKey")
    store.connect { connected ->
      if (!connected.ok) return@connect cannotSay(connected.name)
      subscriptions { subscriptions, held ->
        if (!subscriptions.ok) return@subscriptions cannotSay(subscriptions.name)
        // Acknowledged as soon as seen, whatever becomes of the other query: the three days are running.
        acknowledgeDelivered(held)
        store.purchases(ProductType.ONE_TIME, includeSuspended = false) { oneTime, bought ->
          if (!oneTime.ok) return@purchases cannotSay(oneTime.name)
          acknowledgeDelivered(bought)
          done(PlayAnswer.answer((held + bought).flatMap(::facts)).json)
        }
      }
    }
  }

  /**
   * The subscriptions held, suspended ones included where this Play Store can
   * say. One that cannot (its billing service predates the question) refuses
   * the whole query; asked again without it, it returns the active ones, and
   * a suspended one is then simply absent, which also means no access.
   * Without this second question such a phone would never get an answer, and
   * a buyer on it would never get Pro.
   */
  private fun subscriptions(done: (StoreResult, List<StorePurchase>) -> Unit) {
    store.purchases(ProductType.SUBSCRIPTION, includeSuspended = true) { result, held ->
      if (result.name != StoreResult.FEATURE_NOT_SUPPORTED) return@purchases done(result, held)
      store.purchases(ProductType.SUBSCRIPTION, includeSuspended = false, done)
    }
  }

  /** The products among [ids] as Play offers them to this buyer (JSON, `StoreProduct[]`), or [failed] with why. */
  fun products(ids: List<String>, done: (String) -> Unit, failed: (String) -> Unit) {
    val wanted = ids.filter { it in PlayCatalogue.all }
    if (wanted.isEmpty() || !verifier.canVerify) return done("[]")
    store.connect { connected ->
      if (!connected.ok) return@connect failed(connected.name)
      productsOf(wanted, ProductType.SUBSCRIPTION, failed) { subscriptions ->
        productsOf(wanted, ProductType.ONE_TIME, failed) { oneTime -> done(PlayOffers.json(ids, subscriptions + oneTime)) }
      }
    }
  }

  private fun productsOf(ids: List<String>, type: ProductType, failed: (String) -> Unit, done: (List<PlayProduct>) -> Unit) {
    val ofType = ids.filter { typeOf(it) == type }
    // Play refuses a query with no products; none asked for is none offered.
    if (ofType.isEmpty()) return done(emptyList())
    store.products(ofType, type) { result, products -> if (result.ok) done(products) else failed(result.name) }
  }

  /**
   * Opens Play's purchase sheet and reports how it ended (src/pro/schema.ts
   * `PurchaseOutcome`). "purchased" only for a verified, paid purchase;
   * "pending" for one still clearing, which unlocks nothing.
   */
  fun purchase(activity: Activity?, productId: String, offerToken: String?, done: (String) -> Unit) {
    if (productId !in PlayCatalogue.all || !verifier.canVerify) return done("unavailable")
    if (activity == null) return done("failed")
    // One sheet at a time: Play reports the outcome without saying which request it answers.
    // Play's sheet covers the app, so a new request means the last sheet is gone, whether or
    // not Play ever said how it ended: that request is closed, so it cannot block this one.
    finish("failed")
    inFlight = productId to done
    store.connect { connected ->
      if (!connected.ok) return@connect finish(outcomeOf(connected))
      // Abandoned while connecting: nobody would hear how the sheet ends, so it is not opened.
      if (inFlight == null) return@connect
      store.launch(activity, productId, typeOf(productId), offerToken?.takeIf { it.isNotEmpty() }) { launched ->
        // Opened: the outcome arrives in purchasesUpdated. Not opened: this is the outcome.
        if (!launched.ok) finish(outcomeOf(launched))
      }
    }
  }

  /**
   * A module is going away: nobody is left to hear how an open sheet ends.
   * Its [listener] stops hearing of changes, unless a newer module's has
   * already taken its place (a reload can create the new one first).
   */
  fun abandon(listener: () -> Unit) {
    finish("failed")
    if (onChange === listener) onChange = null
  }

  private fun finish(outcome: String) {
    val (_, done) = inFlight ?: return
    inFlight = null
    done(outcome)
  }

  private fun purchasesUpdated(result: StoreResult, purchases: List<StorePurchase>) {
    acknowledgeDelivered(purchases)
    inFlight?.let { (productId, _) ->
      val mine = purchases.filter { productId in it.productIds }
      when {
        !result.ok -> finish(outcomeOf(result))
        // News of something else (another product's payment clearing while the sheet is open):
        // this sheet has not ended yet.
        mine.isEmpty() -> Unit
        mine.any { it.state == PlayAnswer.PURCHASED && isVerified(it) } -> finish("purchased")
        mine.any { it.state == PlayAnswer.PENDING } -> finish("pending")
        // Reported as bought, but not something Play signed for this app.
        else -> finish("failed")
      }
    }
    // Also with no sheet open: a payment that cleared, a purchase made in the Play Store.
    onChange?.invoke()
  }

  private fun outcomeOf(result: StoreResult): String =
      when (result.code) {
        StoreResult.Code.USER_CANCELED -> "cancelled"
        StoreResult.Code.ALREADY_OWNED -> "alreadyOwned"
        StoreResult.Code.UNAVAILABLE -> "unavailable"
        StoreResult.Code.OK,
        StoreResult.Code.ERROR -> "failed"
      }

  private fun typeOf(productId: String) =
      if (productId in PlayCatalogue.subscriptions) ProductType.SUBSCRIPTION else ProductType.ONE_TIME

  private fun isVerified(purchase: StorePurchase) = verifier.verified(purchase.originalJson, purchase.signature)

  private fun facts(purchase: StorePurchase): List<PurchaseFact> {
    val verified = isVerified(purchase)
    return purchase.productIds.map { productId ->
      PurchaseFact(productId, purchase.state, purchase.suspended, purchase.autoRenewing, verified)
    }
  }

  /**
   * Acknowledges every paid, verified purchase of zero's that is not yet
   * acknowledged: in the listener and on every query, because Play refunds a
   * purchase left unacknowledged for three days. Never a pending one (Play
   * forbids it), never one that failed verification (it was not delivered).
   * A failure is tried again on the next query.
   */
  private fun acknowledgeDelivered(purchases: List<StorePurchase>) {
    purchases
        .filter { it.state == PlayAnswer.PURCHASED && !it.acknowledged }
        .filter { purchase -> purchase.productIds.isNotEmpty() && purchase.productIds.all { it in PlayCatalogue.all } }
        .filter(::isVerified)
        .forEach { store.acknowledge(it.token) {} }
  }
}
