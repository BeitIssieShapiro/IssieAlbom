package com.issiealbum

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log

class MainActivity : ReactActivity() {

  companion object {
    private const val TAG = "IssieAlbum.MainActivity"
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "IssieAlbum"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  /**
   * Handle the Intent when the app starts from scratch (COLD START)
   */
  override fun onCreate(savedInstanceState: Bundle?): Unit {
    Log.d(TAG, "onCreate called")
    Log.d(TAG, "Original intent action: ${intent?.action}")
    Log.d(TAG, "Original intent data: ${intent?.data}")
    Log.d(TAG, "Original intent extras: ${intent?.extras?.keySet()}")

    // Set the Intent property with the modified Intent data before super.onCreate runs.
    // This ensures React Native's built-in deep link handling reads the correct data.
    intent = modifyIntentForSharing(intent)

    // IMPORTANT: Must call super.onCreate after the intent is modified.
    super.onCreate(savedInstanceState)
  }

  /**
   * Handle the Intent when the app is resumed from background (WARM START)
   */
  override fun onNewIntent(intent: Intent) {
    Log.d(TAG, "onNewIntent called")
    Log.d(TAG, "New intent action: ${intent.action}")
    Log.d(TAG, "New intent data: ${intent.data}")

    val modifiedIntent = modifyIntentForSharing(intent)

    // IMPORTANT: Must call super.onNewIntent with the potentially modified Intent.
    super.onNewIntent(modifiedIntent ?: intent)
  }

  /**
   * Utility function to apply the common logic for modifying the Intent.
   * This function extracts ACTION_SEND data and remaps it to an ACTION_VIEW deep link format.
   */
  private fun modifyIntentForSharing(intent: Intent?): Intent? {
    intent ?: return null

    Log.d(TAG, "modifyIntentForSharing called")
    Log.d(TAG, "Intent action: ${intent.action}")

    // 1. Determine the relevant URI based on the Intent Action
    val sharedUri: Uri? =
      if (Intent.ACTION_SEND == intent.action) {
        Log.d(TAG, "ACTION_SEND detected")
        // Get URI from EXTRA_STREAM for ACTION_SEND
        @Suppress("DEPRECATION")
        val uri = intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
        Log.d(TAG, "EXTRA_STREAM URI: $uri")
        uri
      } else {
        Log.d(TAG, "Not ACTION_SEND, using intent.data")
        // Get URI from intent.data for deep links (e.g., ACTION_VIEW)
        intent.data
      }

    // 2. Process the extracted URI if it exists
    sharedUri?.let { uri ->
      // Convert the URI to a string.
      val uriString = uri.toString()
      Log.d(TAG, "Processing URI: $uriString")

      // Modify the existing intent object to be read as a deep link (ACTION_VIEW).
      intent.data = Uri.parse(uriString)
      intent.action = Intent.ACTION_VIEW
      Log.d(TAG, "Modified intent action to ACTION_VIEW with data: ${intent.data}")
    }

    if (sharedUri == null) {
      Log.d(TAG, "No URI found in intent")
    }

    // Return the (potentially) modified intent
    return intent
  }
}
