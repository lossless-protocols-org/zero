package com.anotherwhy.zero.quickadd

import android.animation.ValueAnimator
import android.os.Build
import android.os.Bundle
import android.view.animation.PathInterpolator
import com.anotherwhy.zero.R
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultReactActivityDelegate

/**
 * The quick-add sheet (2.8): a see-through activity over the home screen that
 * hosts the `zeroQuickAdd` React root (src/quickAdd) on the app's one
 * ReactHost. Its own task and out of Recents, so saving or dismissing leaves
 * the user exactly where they were, never inside the full app.
 */
class QuickAddActivity : ReactActivity() {

  override fun getMainComponentName(): String = "zeroQuickAdd"

  override fun onCreate(savedInstanceState: Bundle?) {
    // As MainActivity: no fragment restoration after a process death.
    super.onCreate(null)
    // In: a fade, not the platform's slide or zoom (the card's own motion is
    // React's). Out: nothing, because the sheet has already faded its card and
    // its dim (fadeScrim) by the time it closes; a system animation after that
    // would only hold an empty dim on screen.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      overrideActivityTransition(OVERRIDE_TRANSITION_OPEN, R.anim.quick_add_in, 0)
      overrideActivityTransition(OVERRIDE_TRANSITION_CLOSE, 0, 0)
    } else {
      @Suppress("DEPRECATION")
      overridePendingTransition(R.anim.quick_add_in, 0)
    }
  }

  /**
   * Brings React's light/dark scheme up to date. The app's one React instance
   * outlives this sheet: when the phone switched theme while zero sat in the
   * background, no activity was there to pass the change on, and the next
   * sheet opened in the old theme (Moto, 2026-11-09). A new activity starts
   * with the new configuration but gets no onConfigurationChanged, so it says
   * so here; the module only emits when the scheme really changed.
   */
  override fun onResume() {
    super.onResume()
    reactHost?.onConfigurationChanged(this)
  }

  override fun finish() {
    super.finish()
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      @Suppress("DEPRECATION")
      overridePendingTransition(0, 0)
    }
  }

  /** Fades the window's dim to nothing, in step with the card leaving (Material emphasized accelerate). */
  fun fadeScrim(durationMs: Long) {
    val from = window.attributes.dimAmount
    ValueAnimator.ofFloat(from, 0f).apply {
      duration = durationMs
      interpolator = PathInterpolator(0.3f, 0f, 0.8f, 0.15f)
      addUpdateListener { window.setDimAmount(it.animatedValue as Float) } // ofFloat: always a Float
      start()
    }
  }

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      object : DefaultReactActivityDelegate(this, mainComponentName) {
        // Initial props for QuickAddRoot: which kind of entry, and a chip's category.
        override fun getLaunchOptions(): Bundle =
            Bundle().apply {
              putString(QuickAdd.EXTRA_KIND, intent.getStringExtra(QuickAdd.EXTRA_KIND) ?: QuickAdd.KIND_EXPENSE)
              putString(QuickAdd.EXTRA_CATEGORY, intent.getStringExtra(QuickAdd.EXTRA_CATEGORY) ?: "")
              putString(QuickAdd.EXTRA_AMOUNT, intent.getStringExtra(QuickAdd.EXTRA_AMOUNT) ?: "")
              putString(QuickAdd.EXTRA_TITLE, intent.getStringExtra(QuickAdd.EXTRA_TITLE) ?: "")
            }
      }
}
