package com.anotherwhy.zero.billing

import android.app.Activity
import android.content.Context
import android.os.Handler
import android.os.Looper
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClient.BillingResponseCode
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams

/**
 * The only file that talks to Google Play's billing library (3.0; Play
 * Billing Library 9, play flavour only). It translates and decides nothing:
 * [PlayBilling] holds the rules.
 *
 * One client for the life of the process, as Google asks ("one active
 * BillingClient connection open at one time"). [connect] is called before
 * every request and connects again whenever the client is not ready.
 *
 * Not `enableAutoServiceReconnection()`: with it, on library 9.1.0 (Moto g84,
 * Android 15), the first query after every set-up logged "already in the
 * process of connecting" and a failed reconnection, and answered about a
 * second later. Connecting before each request does the same job plainly; a
 * service lost between the two is one failed request, which the app reads as
 * "cannot say" and asks again on its next foreground.
 */
class GooglePlayStore(context: Context) : PlayStore {
  private val main = Handler(Looper.getMainLooper())
  private val waitingToConnect = mutableListOf<(StoreResult) -> Unit>()
  private var connectAttempt = 0

  override var onPurchasesUpdated: ((StoreResult, List<StorePurchase>) -> Unit)? = null

  private val appContext = context.applicationContext
  private var client: BillingClient = newClient()

  private fun newClient(): BillingClient =
      BillingClient.newBuilder(appContext)
          .setListener { result, purchases ->
            val reported = purchases.orEmpty().map(::storePurchase)
            main.post { onPurchasesUpdated?.invoke(storeResult(result), reported) }
          }
          // Required by Play for one-time products: cash and bank-approved payments clear later.
          .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
          .build()

  override fun connect(done: (StoreResult) -> Unit) {
    main.post {
      if (client.isReady) return@post done(StoreResult.OK)
      waitingToConnect += done
      // One set-up at a time: the others wait for its result.
      if (waitingToConnect.size > 1) return@post
      val attempt = ++connectAttempt
      // A set-up Play never answers must not leave the app waiting for ever.
      main.postDelayed({ if (attempt == connectAttempt) timedOut(attempt) }, CONNECT_TIMEOUT_MS)
      try {
        client.startConnection(
            object : BillingClientStateListener {
              override fun onBillingSetupFinished(result: BillingResult) = connected(attempt, storeResult(result))

              // Nothing to do: the next request finds the client not ready and connects again.
              override fun onBillingServiceDisconnected() = Unit
            })
      } catch (error: RuntimeException) {
        // Seen on phones where the Play Store is missing, disabled or blocked.
        connected(attempt, StoreResult(StoreResult.Code.UNAVAILABLE, "startConnection: ${error.javaClass.simpleName}"))
      }
    }
  }

  /**
   * A set-up Play never answered. The client would stay "connecting" and refuse every later
   * attempt, so it is closed and replaced: the next request starts clean.
   */
  private fun timedOut(attempt: Int) {
    try {
      client.endConnection()
    } catch (_: RuntimeException) {
      // Closing a client that never connected: nothing to close.
    }
    client = newClient()
    connected(attempt, StoreResult(StoreResult.Code.ERROR, "connectTimeout"))
  }

  /** Releases everyone waiting on set-up [attempt], once: its result or its timeout, whichever comes first. */
  private fun connected(attempt: Int, result: StoreResult) {
    main.post {
      if (attempt != connectAttempt) return@post
      connectAttempt++
      val waiting = waitingToConnect.toList()
      waitingToConnect.clear()
      waiting.forEach { it(result) }
    }
  }

  override fun purchases(type: ProductType, includeSuspended: Boolean, done: (StoreResult, List<StorePurchase>) -> Unit) {
    val params =
        QueryPurchasesParams.newBuilder()
            .setProductType(playType(type))
            // Paused or on hold: still the user's, with no access. Without this they are simply not returned.
            .includeSuspendedSubscriptions(includeSuspended)
            .build()
    client.queryPurchasesAsync(params) { result, purchases ->
      val held = purchases.map(::storePurchase)
      main.post { done(storeResult(result), held) }
    }
  }

  override fun products(ids: List<String>, type: ProductType, done: (StoreResult, List<PlayProduct>) -> Unit) {
    details(ids, type) { result, found -> done(result, found.map(::playProduct)) }
  }

  private fun details(ids: List<String>, type: ProductType, done: (StoreResult, List<ProductDetails>) -> Unit) {
    val products =
        ids.map { QueryProductDetailsParams.Product.newBuilder().setProductId(it).setProductType(playType(type)).build() }
    client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(products).build()) { result, found ->
      // A product Play could not fetch (not found, no offer for this buyer) is in the
      // unfetched list, and simply not offered here.
      val fetched = found.productDetailsList
      main.post { done(storeResult(result), fetched) }
    }
  }

  override fun launch(activity: Activity, productId: String, type: ProductType, offerToken: String?, done: (StoreResult) -> Unit) {
    // Fetched afresh for every purchase: Google warns that a cached ProductDetails can fail the flow.
    details(listOf(productId), type) { fetched, found ->
      if (!fetched.ok) return@details done(fetched)
      val product =
          found.firstOrNull { it.productId == productId }
              ?: return@details done(StoreResult(StoreResult.Code.UNAVAILABLE, "ITEM_UNAVAILABLE"))
      // The token the app chose from getProducts; failing that, the offer zero sells.
      val token =
          offerToken
              ?: when (type) {
                ProductType.SUBSCRIPTION -> PlayOffers.chosen(playProduct(product).offers)?.offerToken
                ProductType.ONE_TIME -> product.oneTimePurchaseOfferDetailsList?.firstOrNull()?.offerToken
              }
      if (type == ProductType.SUBSCRIPTION && token == null) {
        return@details done(StoreResult(StoreResult.Code.UNAVAILABLE, "noOffer"))
      }
      val item = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(product)
      if (!token.isNullOrEmpty()) item.setOfferToken(token)
      val params = BillingFlowParams.newBuilder().setProductDetailsParamsList(listOf(item.build())).build()
      done(storeResult(client.launchBillingFlow(activity, params)))
    }
  }

  override fun acknowledge(token: String, done: (StoreResult) -> Unit) {
    client.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(token).build()) { result ->
      main.post { done(storeResult(result)) }
    }
  }

  companion object {
    private const val CONNECT_TIMEOUT_MS = 10_000L

    private fun playType(type: ProductType) =
        when (type) {
          ProductType.SUBSCRIPTION -> BillingClient.ProductType.SUBS
          ProductType.ONE_TIME -> BillingClient.ProductType.INAPP
        }

    /** Play's response code as the app acts on it. Anything not listed, today's or a later library's, is an error. */
    fun storeResult(code: Int): StoreResult =
        when (code) {
          BillingResponseCode.OK -> StoreResult.OK
          BillingResponseCode.USER_CANCELED -> StoreResult(StoreResult.Code.USER_CANCELED, "USER_CANCELED")
          BillingResponseCode.ITEM_ALREADY_OWNED -> StoreResult(StoreResult.Code.ALREADY_OWNED, "ITEM_ALREADY_OWNED")
          BillingResponseCode.BILLING_UNAVAILABLE -> StoreResult(StoreResult.Code.UNAVAILABLE, "BILLING_UNAVAILABLE")
          BillingResponseCode.ITEM_UNAVAILABLE -> StoreResult(StoreResult.Code.UNAVAILABLE, "ITEM_UNAVAILABLE")
          BillingResponseCode.FEATURE_NOT_SUPPORTED -> StoreResult(StoreResult.Code.UNAVAILABLE, "FEATURE_NOT_SUPPORTED")
          BillingResponseCode.SERVICE_DISCONNECTED -> StoreResult(StoreResult.Code.ERROR, "SERVICE_DISCONNECTED")
          BillingResponseCode.SERVICE_UNAVAILABLE -> StoreResult(StoreResult.Code.ERROR, "SERVICE_UNAVAILABLE")
          BillingResponseCode.NETWORK_ERROR -> StoreResult(StoreResult.Code.ERROR, "NETWORK_ERROR")
          BillingResponseCode.DEVELOPER_ERROR -> StoreResult(StoreResult.Code.ERROR, "DEVELOPER_ERROR")
          BillingResponseCode.ITEM_NOT_OWNED -> StoreResult(StoreResult.Code.ERROR, "ITEM_NOT_OWNED")
          BillingResponseCode.ERROR -> StoreResult(StoreResult.Code.ERROR, "ERROR")
          else -> StoreResult(StoreResult.Code.ERROR, "code $code")
        }

    private fun storeResult(result: BillingResult) = storeResult(result.responseCode)

    private fun storePurchase(purchase: Purchase) =
        StorePurchase(
            productIds = purchase.products,
            state =
                when (purchase.purchaseState) {
                  Purchase.PurchaseState.PURCHASED -> PlayAnswer.PURCHASED
                  Purchase.PurchaseState.PENDING -> PlayAnswer.PENDING
                  else -> "unspecified"
                },
            suspended = purchase.isSuspended,
            autoRenewing = purchase.isAutoRenewing,
            acknowledged = purchase.isAcknowledged,
            token = purchase.purchaseToken,
            originalJson = purchase.originalJson,
            signature = purchase.signature,
        )

    private fun playProduct(details: ProductDetails): PlayProduct {
      val oneTime = details.oneTimePurchaseOfferDetails
      return PlayProduct(
          productId = details.productId,
          oneTimePrice = oneTime?.formattedPrice,
          oneTimeCurrency = oneTime?.priceCurrencyCode,
          oneTimeOfferToken = details.oneTimePurchaseOfferDetailsList?.firstOrNull()?.offerToken,
          offers =
              details.subscriptionOfferDetails.orEmpty().map { offer ->
                SubscriptionOffer(
                    basePlanId = offer.basePlanId,
                    offerId = offer.offerId,
                    offerToken = offer.offerToken,
                    phases =
                        offer.pricingPhases.pricingPhaseList.map { phase ->
                          OfferPhase(
                              priceMicros = phase.priceAmountMicros,
                              formattedPrice = phase.formattedPrice,
                              currencyCode = phase.priceCurrencyCode,
                              billingPeriod = phase.billingPeriod,
                              cycleCount = phase.billingCycleCount,
                              recurring = phase.recurrenceMode == ProductDetails.RecurrenceMode.INFINITE_RECURRING,
                            )
                        },
                  )
              },
        )
    }
  }
}
