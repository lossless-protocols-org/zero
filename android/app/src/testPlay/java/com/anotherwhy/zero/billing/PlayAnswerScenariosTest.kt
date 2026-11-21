package com.anotherwhy.zero.billing

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The Google Play side of contracts/billing-scenarios.json (3.0): for every
 * scenario, the facts Play's client would report become exactly the answer
 * the fixture names. The JS suite checks what each answer means for Pro, so
 * the two sides cannot read one situation differently.
 */
class PlayAnswerScenariosTest {
  private val fixture: JSONObject by lazy {
    val stream = checkNotNull(javaClass.classLoader?.getResourceAsStream("billing-scenarios.json")) {
      "billing-scenarios.json missing from contracts/ (android/app/build.gradle test resources)"
    }
    JSONObject(stream.bufferedReader().use { it.readText() })
  }

  private fun strings(array: JSONArray) = (0 until array.length()).map(array::getString)

  /** A JSON value as text with every object's keys sorted. */
  private fun canonical(value: Any?): String =
      when (value) {
        is JSONObject -> value.keys().asSequence().sorted().joinToString(",", "{", "}") { "\"$it\":" + canonical(value.get(it)) }
        is JSONArray -> (0 until value.length()).joinToString(",", "[", "]") { canonical(value.get(it)) }
        is String -> JSONObject.quote(value)
        else -> value.toString()
      }

  @Test
  fun `the catalogue is the one the app knows`() {
    val products = fixture.getJSONObject("products").getJSONObject("android")
    assertEquals(PlayCatalogue.subscriptions, strings(products.getJSONArray("subscription")))
    assertEquals(PlayCatalogue.lifetime, strings(products.getJSONArray("lifetime")))
  }

  @Test
  fun `every scenario maps to its answer`() {
    val scenarios = fixture.getJSONArray("scenarios")
    var checked = 0
    for (i in 0 until scenarios.length()) {
      val scenario = scenarios.getJSONObject(i)
      // A scenario with no Play side is the App Store's (BillingScenariosTests.swift).
      val android = scenario.optJSONObject("android") ?: continue
      checked++
      val facts = android.getJSONArray("facts")
      val answer = PlayAnswer.answer((0 until facts.length()).map { PurchaseFact.fromJson(facts.getJSONObject(it)) })
      // Compared with keys in order, so key order and spacing play no part.
      assertEquals(scenario.getString("name"), canonical(android.getJSONObject("answer")), canonical(JSONObject(answer.json)))
    }
    assertTrue("the fixture was read", checked >= 12)
  }

  @Test
  fun `an absent value is written as null, never left out`() {
    val known = StoreAnswer.Known(listOf(StoreRecord("zero_pro_lifetime", "active", willRenew = null, verified = true)))
    // Every key present, in whatever order the JSON library writes them.
    assertEquals(
        """{"entitlements":[{"expiresAtMs":null,"productId":"zero_pro_lifetime","status":"active","verified":true,"willRenew":null}],"kind":"known"}""",
        canonical(JSONObject(known.json)),
    )
    assertEquals("""{"kind":"unknown","reason":"x"}""", canonical(JSONObject(StoreAnswer.Unknown("x").json)))
  }
}
