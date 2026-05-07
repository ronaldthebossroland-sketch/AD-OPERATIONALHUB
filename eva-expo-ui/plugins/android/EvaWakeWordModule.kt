package com.adoperationalhub.eva

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.speech.SpeechRecognizer
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class EvaWakeWordModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "EvaWakeWord"

  @ReactMethod
  fun isAvailable(promise: Promise) {
    val result = Arguments.createMap()
    result.putBoolean("available", SpeechRecognizer.isRecognitionAvailable(reactContext))
    result.putBoolean("android", true)
    result.putString("mode", "android_speech_recognizer")
    promise.resolve(result)
  }

  @ReactMethod
  fun start(promise: Promise) {
    if (!SpeechRecognizer.isRecognitionAvailable(reactContext)) {
      promise.reject("unavailable", "Wake word listening is not available on this phone.")
      return
    }

    if (!hasMicrophonePermission()) {
      promise.reject("permission_required", "Microphone access is needed for Hi EVA.")
      return
    }

    try {
      val intent = Intent(reactContext, EvaWakeWordService::class.java).apply {
        action = EvaWakeWordService.ACTION_START
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        ContextCompat.startForegroundService(reactContext, intent)
      } else {
        reactContext.startService(intent)
      }

      reactContext
        .getSharedPreferences(EvaWakeWordService.PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .putBoolean(EvaWakeWordService.PREF_ENABLED, true)
        .apply()

      promise.resolve(statusMap("listening"))
    } catch (error: Exception) {
      promise.reject("start_failed", error.message ?: "Could not start Hi EVA.")
    }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    try {
      val intent = Intent(reactContext, EvaWakeWordService::class.java).apply {
        action = EvaWakeWordService.ACTION_STOP
      }
      reactContext.startService(intent)
      reactContext.stopService(intent)
      reactContext
        .getSharedPreferences(EvaWakeWordService.PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .putBoolean(EvaWakeWordService.PREF_ENABLED, false)
        .apply()
      promise.resolve(statusMap("off"))
    } catch (error: Exception) {
      promise.reject("stop_failed", error.message ?: "Could not stop Hi EVA.")
    }
  }

  @ReactMethod
  fun getStatus(promise: Promise) {
    val prefs = reactContext.getSharedPreferences(EvaWakeWordService.PREFS_NAME, Context.MODE_PRIVATE)
    val enabled = prefs.getBoolean(EvaWakeWordService.PREF_ENABLED, false)
    val status = when {
      EvaWakeWordService.isRunning -> "listening"
      enabled -> "enabled"
      else -> "off"
    }
    promise.resolve(statusMap(status))
  }

  @ReactMethod
  fun consumeWakeWordEvent(promise: Promise) {
    val prefs = reactContext.getSharedPreferences(EvaWakeWordService.PREFS_NAME, Context.MODE_PRIVATE)
    val detectedAt = prefs.getLong(EvaWakeWordService.PREF_LAST_DETECTED_AT, 0L)
    val consumedAt = prefs.getLong("last_consumed_at", 0L)
    val detected = detectedAt > consumedAt
    if (detected) {
      prefs.edit().putLong("last_consumed_at", detectedAt).apply()
    }

    val result = Arguments.createMap()
    result.putBoolean("detected", detected)
    result.putDouble("timestamp", detectedAt.toDouble())
    result.putString("phrase", prefs.getString(EvaWakeWordService.PREF_LAST_PHRASE, "") ?: "")
    result.putBoolean("running", EvaWakeWordService.isRunning)
    promise.resolve(result)
  }

  private fun hasMicrophonePermission(): Boolean =
    ContextCompat.checkSelfPermission(reactContext, Manifest.permission.RECORD_AUDIO) ==
      PackageManager.PERMISSION_GRANTED

  private fun statusMap(status: String) = Arguments.createMap().apply {
    putString("status", status)
    putBoolean("running", EvaWakeWordService.isRunning)
    putBoolean("available", SpeechRecognizer.isRecognitionAvailable(reactContext))
  }
}
