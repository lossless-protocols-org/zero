package com.anotherwhy.zero.billing

import android.util.Base64
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.Signature
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * Purchases are checked on the phone against the app's licence key (3.0): the
 * signature Play makes is RSA over the purchase JSON with SHA-1, Base64
 * encoded. A key pair made here stands in for Play's.
 */
@RunWith(RobolectricTestRunner::class)
class PurchaseVerifierTest {
  private val play: KeyPair = KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.generateKeyPair()
  private val licenceKey = Base64.encodeToString(play.public.encoded, Base64.NO_WRAP)
  private val verifier = PurchaseVerifier(licenceKey, "com.anotherwhy.zero")
  private val purchase =
      """{"orderId":"GPA.1","packageName":"com.anotherwhy.zero","productId":"zero_pro_lifetime","purchaseState":0,"purchaseToken":"t"}"""

  private fun signed(json: String, by: KeyPair = play): String {
    val signature = Signature.getInstance("SHA1withRSA")
    signature.initSign(by.private)
    signature.update(json.toByteArray(Charsets.UTF_8))
    return Base64.encodeToString(signature.sign(), Base64.NO_WRAP)
  }

  @Test
  fun `what Play signed for this app is verified`() {
    assertTrue(verifier.canVerify)
    assertTrue(verifier.verified(purchase, signed(purchase)))
  }

  @Test
  fun `data changed after signing is not`() {
    assertFalse(verifier.verified(purchase.replace("zero_pro_lifetime", "zero_pro"), signed(purchase)))
  }

  @Test
  fun `a signature made with another key is not`() {
    val forger = KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.generateKeyPair()
    assertFalse(verifier.verified(purchase, signed(purchase, forger)))
  }

  @Test
  fun `a genuine purchase of another app is not`() {
    val other = purchase.replace("com.anotherwhy.zero", "com.example.other")
    assertFalse(verifier.verified(other, signed(other)))
    // The QA build is another app to Play: its purchases are its own.
    assertFalse(PurchaseVerifier(licenceKey, "com.anotherwhy.zero.qa").verified(purchase, signed(purchase)))
  }

  @Test
  fun `garbage is not, and does not throw`() {
    for ((json, signature) in
        listOf(purchase to "", purchase to "not base64 !!", purchase to "AAAA", "" to signed(""), "not json" to signed("not json"))) {
      assertFalse("$json / $signature", verifier.verified(json, signature))
    }
  }

  @Test
  fun `without a usable licence key nothing is verified`() {
    for (key in listOf("", "   ", "not a key", "AAAA")) {
      val keyless = PurchaseVerifier(key, "com.anotherwhy.zero")
      assertFalse(key, keyless.canVerify)
      assertFalse(key, keyless.verified(purchase, signed(purchase)))
    }
  }

  @Test
  fun `this build ships no licence key yet, so it sells nothing`() {
    // The day the owner pastes the key from Play Console, this test is deleted with the sentence in PlayCatalogue.
    assertFalse(PurchaseVerifier(PlayCatalogue.LICENCE_KEY, "com.anotherwhy.zero").canVerify)
  }
}
