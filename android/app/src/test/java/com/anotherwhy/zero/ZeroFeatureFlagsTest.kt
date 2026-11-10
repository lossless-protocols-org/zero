package com.anotherwhy.zero

import com.facebook.react.internal.featureflags.ReactNativeFeatureFlagsOverrides_RNOSS_Stable_Android
import com.facebook.react.internal.featureflags.ReactNativeFeatureFlagsProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * MainApplication swaps React Native's flags after start-up (React Native
 * offers no earlier hook), which is only safe if every flag keeps the value
 * React Native gave it, but one: the pause check, read only when an activity
 * pauses. Every flag of the provider interface is compared, so a React Native
 * upgrade that adds flags is covered too.
 */
class ZeroFeatureFlagsTest {
  private val stable = ReactNativeFeatureFlagsOverrides_RNOSS_Stable_Android()

  @Test
  fun `only the pause check differs from React Native's stable flags`() {
    val flags = ReactNativeFeatureFlagsProvider::class.java.methods.filter { it.parameterCount == 0 }
    assertTrue("no flags found", flags.size > 20)
    val differing = flags.filter { it.invoke(ZeroFeatureFlags) != it.invoke(stable) }.map { it.name }
    assertEquals(listOf("skipActivityIdentityAssertionOnHostPause"), differing)
  }

  @Test
  fun `the pause check logs instead of throwing`() {
    assertFalse(stable.skipActivityIdentityAssertionOnHostPause())
    assertTrue(ZeroFeatureFlags.skipActivityIdentityAssertionOnHostPause())
  }
}
