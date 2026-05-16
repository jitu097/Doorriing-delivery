package com.doorriing.delivery

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import android.util.Log

class DoorriingDeliveryApp : Application() {

    companion object {
        const val CHANNEL_ID = "doorriing_delivery_channel"
        const val CHANNEL_NAME = "Delivery Alerts"
        const val CHANNEL_DESC = "High-priority notifications for new delivery assignments"
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = CHANNEL_DESC
                enableVibration(true)
                enableLights(true)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
            Log.d("FCM_DEBUG", "DoorriingDeliveryApp: Notification channel '$CHANNEL_ID' created/verified at startup")
        }
    }
}
