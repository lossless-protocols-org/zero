package com.anotherwhy.zero

import android.content.Intent
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "zero"

  override fun onCreate(savedInstanceState: Bundle?) {
    // Pass null to prevent Android from restoring fragments after the OS
    // kills the app in the background. react-native-screens does not
    // support fragment restoration and will crash with IllegalStateException.
    super.onCreate(null)
  }

  /**
   * Keeps the newest intent as the activity's own. A widget tap on a task
   * whose process the system killed lands here before React is running: RN
   * drops a URL it cannot emit yet, but React Navigation's first read
   * (Linking.getInitialURL) uses getIntent(), so the tap still opens the
   * screen it named instead of Home.
   */
  override fun onNewIntent(intent: Intent) {
    setIntent(intent)
    super.onNewIntent(intent)
  }

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
