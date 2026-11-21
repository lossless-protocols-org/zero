package com.anotherwhy.zero.billing

import android.util.Base64
import java.security.KeyFactory
import java.security.PublicKey
import java.security.Signature
import java.security.spec.X509EncodedKeySpec
import org.json.JSONObject

/**
 * Checks that a purchase is what Google Play signed, for this app (3.0).
 *
 * Play signs each purchase's JSON with the app's private licence key
 * (`Purchase.getOriginalJson()`, `Purchase.getSignature()`); the public half
 * is in Play Console. zero has no server, so this check on the device is the
 * whole verification: it stops a generic fake billing service, not somebody
 * who rebuilds the app, which is true of any check on a phone.
 */
class PurchaseVerifier(licenceKey: String, private val packageName: String) {
  private val key: PublicKey? =
      try {
        if (licenceKey.isBlank()) null
        else KeyFactory.getInstance("RSA").generatePublic(X509EncodedKeySpec(Base64.decode(licenceKey, Base64.DEFAULT)))
      } catch (_: Exception) {
        // A licence key that is not a key verifies nothing, like no key at all.
        null
      }

  /** False without a usable licence key: then nothing can be verified, and nothing is sold. */
  val canVerify: Boolean
    get() = key != null

  /**
   * True when [signature] is Play's over exactly [originalJson], and the
   * signed data names this app. The products are read from the same signed
   * data by the caller (`Purchase.getProducts()` parses [originalJson]).
   */
  fun verified(originalJson: String, signature: String): Boolean {
    val publicKey = key ?: return false
    return try {
      val check = Signature.getInstance("SHA1withRSA")
      check.initVerify(publicKey)
      check.update(originalJson.toByteArray(Charsets.UTF_8))
      check.verify(Base64.decode(signature, Base64.DEFAULT)) && JSONObject(originalJson).optString("packageName") == packageName
    } catch (_: Exception) {
      // A signature that is not Base64, data that is not JSON: not verified.
      false
    }
  }
}
