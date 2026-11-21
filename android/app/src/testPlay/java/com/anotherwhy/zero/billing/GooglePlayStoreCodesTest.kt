package com.anotherwhy.zero.billing

import com.android.billingclient.api.BillingClient.BillingResponseCode
import java.lang.reflect.Modifier
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Every response code the billing library can return has a reading, and only
 * OK is ok. The codes are read from the library itself, so one added by a
 * version bump fails here until someone has decided what it means. That
 * anything not ok becomes "cannot say" (3.0 law L3) is PlayBillingTest's.
 */
class GooglePlayStoreCodesTest {
  private val codes: Map<String, Int> =
      BillingResponseCode::class
          .java
          .fields
          .filter { Modifier.isStatic(it.modifiers) && it.type == Int::class.javaPrimitiveType }
          .associate { it.name to it.getInt(null) }

  @Test
  fun `the library's codes were found`() {
    assertTrue(codes.toString(), codes.size >= 12)
    assertEquals(0, codes["OK"])
  }

  @Test
  fun `only OK is ok, and every code is known by its own name`() {
    // Deprecated since library 6 and never returned; it reads as an error like any unknown code.
    val retired = setOf("SERVICE_TIMEOUT")
    for ((name, code) in codes) {
      val result = GooglePlayStore.storeResult(code)
      assertEquals(name, name == "OK", result.ok)
      if (name !in retired) assertEquals(name, result.name)
    }
  }

  @Test
  fun `what the app acts on`() {
    fun codeOf(name: String) = GooglePlayStore.storeResult(codes.getValue(name)).code
    assertEquals(StoreResult.Code.USER_CANCELED, codeOf("USER_CANCELED"))
    assertEquals(StoreResult.Code.ALREADY_OWNED, codeOf("ITEM_ALREADY_OWNED"))
    for (name in listOf("BILLING_UNAVAILABLE", "ITEM_UNAVAILABLE", "FEATURE_NOT_SUPPORTED")) {
      assertEquals(name, StoreResult.Code.UNAVAILABLE, codeOf(name))
    }
    for (name in listOf("SERVICE_DISCONNECTED", "SERVICE_UNAVAILABLE", "NETWORK_ERROR", "DEVELOPER_ERROR", "ITEM_NOT_OWNED", "ERROR")) {
      assertEquals(name, StoreResult.Code.ERROR, codeOf(name))
    }
  }

  @Test
  fun `a code from a later library is an error, never ok`() {
    val result = GooglePlayStore.storeResult(4242)
    assertEquals(StoreResult.Code.ERROR, result.code)
    assertEquals("code 4242", result.name)
  }
}
