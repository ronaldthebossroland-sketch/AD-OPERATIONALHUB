package com.adoperationalhub.eva

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import java.util.Locale

class EvaWakeWordService : Service(), RecognitionListener {
  companion object {
    const val ACTION_START = "com.adoperationalhub.eva.action.START_WAKE_WORD"
    const val ACTION_STOP = "com.adoperationalhub.eva.action.STOP_WAKE_WORD"
    const val ACTION_WAKE_WORD = "com.adoperationalhub.eva.action.WAKE_WORD"
    const val PREFS_NAME = "eva_wake_word"
    const val PREF_ENABLED = "enabled"
    const val PREF_LAST_DETECTED_AT = "last_detected_at"
    const val PREF_LAST_PHRASE = "last_phrase"
    const val CHANNEL_ID = "eva-wake-word"
    const val NOTIFICATION_ID = 4401

    @Volatile
    var isRunning = false
  }

  private val handler = Handler(Looper.getMainLooper())
  private var recognizer: SpeechRecognizer? = null
  private var isListening = false
  private var lastDetectionAt = 0L
  private var pendingHandoff = false

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
    if (SpeechRecognizer.isRecognitionAvailable(this)) {
      recognizer = SpeechRecognizer.createSpeechRecognizer(this).also {
        it.setRecognitionListener(this)
      }
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .putBoolean(PREF_ENABLED, false)
        .apply()
      stopSelf()
      return START_NOT_STICKY
    }

    pendingHandoff = false

    if (!hasMicrophonePermission() || recognizer == null) {
      stopSelf()
      return START_NOT_STICKY
    }

    getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putBoolean(PREF_ENABLED, true)
      .apply()

    isRunning = true
    startForegroundCompat()
    startListeningSoon(250)
    return START_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onDestroy() {
    isRunning = false
    handler.removeCallbacksAndMessages(null)
    try {
      recognizer?.cancel()
      recognizer?.destroy()
    } catch (_: Exception) {
      // Best effort cleanup.
    }
    recognizer = null
    isListening = false
    super.onDestroy()
  }

  private fun hasMicrophonePermission(): Boolean =
    ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) ==
      PackageManager.PERMISSION_GRANTED

  private fun startForegroundCompat() {
    val notification = buildNotification()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(
        NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
      )
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun buildNotification(): Notification {
    val launchIntent = Intent(this, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val pendingIntent = PendingIntent.getActivity(
      this,
      0,
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle("EVA is listening")
      .setContentText("Say Hi EVA to open voice command.")
      .setOngoing(true)
      .setSilent(true)
      .setContentIntent(pendingIntent)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(NotificationManager::class.java)
    val channel = NotificationChannel(
      CHANNEL_ID,
      "Hi EVA",
      NotificationManager.IMPORTANCE_LOW
    ).apply {
      description = "Keeps EVA ready for hands-free voice commands."
      setSound(null, null)
    }
    manager.createNotificationChannel(channel)
  }

  private fun startListeningSoon(delayMs: Long) {
    handler.postDelayed({ startListening() }, delayMs)
  }

  private fun startListening() {
    if (!hasMicrophonePermission() || isListening || recognizer == null) return
    val speechIntent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
      putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
      putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
      putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
      putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5)
      putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, packageName)
    }

    try {
      isListening = true
      recognizer?.startListening(speechIntent)
    } catch (_: Exception) {
      isListening = false
      startListeningSoon(1200)
    }
  }

  private fun handleCandidatePhrases(phrases: List<String>) {
    val matched = phrases.firstOrNull { phrase ->
      val normalized = phrase.lowercase(Locale.US)
      normalized.contains("hi eva") ||
        normalized.contains("hey eva") ||
        normalized.contains("hello eva")
    } ?: return

    val now = System.currentTimeMillis()
    if (now - lastDetectionAt < 5000) return
    lastDetectionAt = now

    getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putLong(PREF_LAST_DETECTED_AT, now)
      .putString(PREF_LAST_PHRASE, matched)
      .apply()

    pendingHandoff = true
    openEvaAssistant()
  }

  private fun openEvaAssistant() {
    val launchIntent = Intent(this, MainActivity::class.java).apply {
      action = ACTION_WAKE_WORD
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or
        Intent.FLAG_ACTIVITY_SINGLE_TOP or
        Intent.FLAG_ACTIVITY_CLEAR_TOP
      putExtra("evaWakeWord", true)
    }
    startActivity(launchIntent)
  }

  override fun onReadyForSpeech(params: Bundle?) = Unit
  override fun onBeginningOfSpeech() = Unit
  override fun onRmsChanged(rmsdB: Float) = Unit
  override fun onBufferReceived(buffer: ByteArray?) = Unit

  override fun onEndOfSpeech() {
    isListening = false
  }

  override fun onError(error: Int) {
    isListening = false
    if (getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getBoolean(PREF_ENABLED, false)) {
      val delay = when (error) {
        SpeechRecognizer.ERROR_NO_MATCH,
        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> 450L
        else -> 1200L
      }
      startListeningSoon(delay)
    }
  }

  override fun onResults(results: Bundle?) {
    isListening = false
    val phrases = results
      ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
      ?.toList()
      ?: emptyList()
    handleCandidatePhrases(phrases)
    if (!pendingHandoff && getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getBoolean(PREF_ENABLED, false)) {
      startListeningSoon(350)
    }
  }

  override fun onPartialResults(partialResults: Bundle?) {
    val phrases = partialResults
      ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
      ?.toList()
      ?: emptyList()
    handleCandidatePhrases(phrases)
  }

  override fun onEvent(eventType: Int, params: Bundle?) = Unit
}
