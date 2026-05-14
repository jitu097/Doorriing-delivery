package com.doorriing.delivery

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException

class MyFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        private const val TAG     = "FCM_Service"
        private const val FCM_TAG = "FCM_DEBUG"          // same tag as MainActivity for unified logcat

        private const val CHANNEL_ID   = "doorriing_delivery_channel"
        private const val CHANNEL_NAME = "Delivery Alerts"
        private const val CHANNEL_DESC = "High-priority notifications for new delivery assignments"

        private const val BASE_URL   = "https://delivery.doorriing.com/"
        private const val PREFS_NAME = "doorriing_prefs"

        private const val KEY_AUTH_TOKEN = "auth_token"
        private const val KEY_FCM_TOKEN  = "fcm_token"   // mirrors MainActivity constant
    }

    // =========================================================================
    // onNewToken — called when:
    //   1. App is installed for the first time
    //   2. App is re-installed / data cleared
    //   3. Firebase rotates the token automatically
    //
    // This is the CANONICAL place to receive the FCM token.
    // =========================================================================
    override fun onNewToken(token: String) {
        super.onNewToken(token)

        Log.i(FCM_TAG, "─────────────────────────────────────────")
        Log.i(FCM_TAG, "onNewToken: NEW FCM TOKEN GENERATED ✓")
        Log.i(FCM_TAG, "onNewToken: TOKEN = $token")

        // Cache the new token in SharedPreferences (so MainActivity can use it too)
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_FCM_TOKEN, token).apply()
        Log.d(FCM_TAG, "onNewToken: Token cached in SharedPreferences ✓")

        // Try to sync to backend immediately
        val authToken = prefs.getString(KEY_AUTH_TOKEN, null)
        if (!authToken.isNullOrBlank()) {
            Log.d(FCM_TAG, "onNewToken: JWT found — syncing token to backend NOW")
            syncTokenToBackend(token, authToken)
        } else {
            Log.w(FCM_TAG, "onNewToken: JWT not yet available — token cached, will send after login")
            Log.w(FCM_TAG, "onNewToken: Ensure web app calls window.AndroidBridge.saveAuthToken(jwt)")
        }
    }

    // =========================================================================
    // onMessageReceived — called when:
    //   1. App is in FOREGROUND (any message type)
    //   2. App is in BACKGROUND/KILLED + message is DATA-ONLY
    //
    // When app is BACKGROUND/KILLED + message has a "notification" block,
    // FCM shows the system notification automatically using manifest metadata.
    // =========================================================================
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        Log.d(FCM_TAG, "─────────────────────────────────────────")
        Log.d(FCM_TAG, "onMessageReceived: PUSH RECEIVED ✓")
        Log.d(FCM_TAG, "onMessageReceived: from         = ${remoteMessage.from}")
        Log.d(FCM_TAG, "onMessageReceived: messageId    = ${remoteMessage.messageId}")
        Log.d(FCM_TAG, "onMessageReceived: notification = ${remoteMessage.notification?.title} / ${remoteMessage.notification?.body}")
        Log.d(FCM_TAG, "onMessageReceived: data         = ${remoteMessage.data}")

        val title   = remoteMessage.notification?.title   ?: remoteMessage.data["title"]   ?: "New Delivery Order"
        val body    = remoteMessage.notification?.body    ?: remoteMessage.data["body"]    ?: "You have a new delivery assignment"
        val orderId = remoteMessage.data["order_id"]
        val type    = remoteMessage.data["type"]

        Log.i(FCM_TAG, "onMessageReceived: Showing notification → title='$title' body='$body'")

        showNotification(title, body, orderId, type)
    }

    // =========================================================================
    // Show native Android notification
    // =========================================================================
    private fun showNotification(title: String, body: String, orderId: String?, type: String?) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        createNotificationChannel(notificationManager)

        val contentIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            if (!orderId.isNullOrBlank()) putExtra("order_id", orderId)
            if (!type.isNullOrBlank())    putExtra("type", type)
        }

        val pendingFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        else
            PendingIntent.FLAG_UPDATE_CURRENT

        val requestCode   = orderId?.hashCode() ?: System.currentTimeMillis().toInt()
        val pendingIntent = PendingIntent.getActivity(this, requestCode, contentIntent, pendingFlags)

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        val notificationId = orderId?.hashCode() ?: System.currentTimeMillis().toInt()
        notificationManager.notify(notificationId, notification)

        Log.i(FCM_TAG, "showNotification: Notification posted ✓ id=$notificationId")
    }

    // =========================================================================
    // Create notification channel (Android 8+ / Oreo+, no-op otherwise)
    // =========================================================================
    private fun createNotificationChannel(manager: NotificationManager) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH).apply {
                description = CHANNEL_DESC
                enableVibration(true)
                enableLights(true)
            }
            manager.createNotificationChannel(channel)
            Log.d(FCM_TAG, "createNotificationChannel: channel '$CHANNEL_ID' created/verified ✓")
        }
    }

    // =========================================================================
    // Send token to backend — called from onNewToken()
    // =========================================================================
    private fun syncTokenToBackend(fcmToken: String, authToken: String) {
        Log.d(FCM_TAG, "syncTokenToBackend: Sending token to → ${BASE_URL}api/delivery/push-token")
        Log.d(FCM_TAG, "syncTokenToBackend: JWT present ✓ (length=${authToken.length})")

        val json = """{"token":"$fcmToken","device_id":"android","platform":"android"}"""
        val body = json.toRequestBody("application/json; charset=utf-8".toMediaType())

        val request = Request.Builder()
            .url("${BASE_URL}api/delivery/push-token")
            .addHeader("Authorization", "Bearer $authToken")
            .addHeader("Content-Type", "application/json")
            .post(body)
            .build()

        OkHttpClient().newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e(FCM_TAG, "syncTokenToBackend: NETWORK FAILURE — ${e.message}")
            }

            override fun onResponse(call: Call, response: Response) {
                response.use { resp ->
                    val respBody = resp.body?.string() ?: "(empty)"
                    if (resp.isSuccessful) {
                        Log.i(FCM_TAG, "syncTokenToBackend: SUCCESS ✓ HTTP ${resp.code}")
                        Log.i(FCM_TAG, "syncTokenToBackend: Token saved in DB — $respBody")
                    } else {
                        Log.e(FCM_TAG, "syncTokenToBackend: FAILED — HTTP ${resp.code} — $respBody")
                    }
                }
            }
        })
    }
}
