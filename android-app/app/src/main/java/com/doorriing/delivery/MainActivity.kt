package com.doorriing.delivery

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import com.google.firebase.messaging.FirebaseMessaging
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val rootUrl = "https://delivery.doorriing.com/"
    private val client = OkHttpClient()

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        webView = WebView(this)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.webViewClient = WebViewClient()
        
        // Add JS Bridge
        webView.addJavascriptInterface(AndroidBridge(), "AndroidBridge")
        
        setContentView(webView)

        // Handle direct intent if opened from notification
        handleIntent(intent)

        // Fetch FCM token and sync
        syncFcmToken()
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        val type = intent?.getStringExtra("type")
        val orderId = intent?.getStringExtra("order_id")

        if (type != null && orderId != null) {
            // Deep link to order
            webView.loadUrl("$rootUrl/delivery/orders/$orderId")
        } else {
            webView.loadUrl(rootUrl)
        }
    }

    private fun syncFcmToken() {
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (task.isSuccessful) {
                val token = task.result
                sendTokenToBackend(token)
            }
        }
    }

    private fun sendTokenToBackend(token: String) {
        val json = """
            {
                "token": "$token",
                "device_id": "android",
                "platform": "android"
            }
        """.trimIndent()

        val body = json.toRequestBody("application/json; charset=utf-8".toMediaType())
        val request = Request.Builder()
            .url("${rootUrl}api/delivery/push-token")
            .post(body)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                e.printStackTrace()
            }
            override fun onResponse(call: Call, response: Response) {
                response.close()
            }
        })
    }

    inner class AndroidBridge {
        @JavascriptInterface
        fun postMessage(message: String) {
            // Handle messages from web if needed
        }

        @JavascriptInterface
        fun syncToken() {
            syncFcmToken()
        }
    }
}
