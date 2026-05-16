package com.doorriing.delivery

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessaging
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException

class MainActivity : AppCompatActivity() {

    companion object {
        private const val TAG     = "MainActivity"
        private const val FCM_TAG = "FCM_DEBUG"

        private const val ROOT_URL = "https://delivery.doorriing.com/"
        private const val API_URL  = "https://doorriing-delivery-3.onrender.com/"

        private const val PREFS_NAME           = "doorriing_prefs"
        private const val KEY_AUTH_TOKEN       = "auth_token"
        private const val KEY_FCM_TOKEN        = "fcm_token"
        private const val KEY_PENDING_ORDER_ID = "pending_order_id"
        private const val KEY_PENDING_TYPE     = "pending_type"

        private const val PERM_REQUEST_CODE    = 1001
    }

    private lateinit var webView: WebView
    private val httpClient = OkHttpClient()

    // Guard: prevents duplicate permission dialogs when Activity restarts
    // (rotation, system kill/recreate) while first dialog is still open.
    // "Can request only one set of permissions at a time" error is caused by
    // calling requestPermissions() a second time before the first resolves.
    private var permissionRequested = false

    // =========================================================================
    // onCreate
    // =========================================================================
    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        Log.d(FCM_TAG, "─────────────────────────────────────────")
        Log.d(FCM_TAG, "MainActivity.onCreate() — app starting")
        Log.d(FCM_TAG, "Android SDK version: ${Build.VERSION.SDK_INT}")

        // ── Step 1: notification permission (once, Android 13+ only) ─────
        requestNotificationPermissionIfNeeded()

        // ── Step 2: WebView ───────────────────────────────────────────────
        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccessFromFileURLs = false
            settings.allowUniversalAccessFromFileURLs = false

            webViewClient = object : WebViewClient() {

                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    request: WebResourceRequest?
                ): Boolean {
                    val url = request?.url?.toString() ?: return false
                    return when {
                        url.startsWith("intent://") -> {
                            try {
                                val intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
                                if (packageManager.resolveActivity(intent, 0) != null) {
                                    startActivity(intent)
                                } else {
                                    val fallback = intent.getStringExtra("browser_fallback_url")
                                    if (!fallback.isNullOrBlank()) view?.loadUrl(fallback)
                                }
                            } catch (e: Exception) { Log.e(TAG, "intent:// error: ${e.message}") }
                            true
                        }
                        url.startsWith("tel:") -> {
                            try { startActivity(Intent(Intent.ACTION_DIAL, Uri.parse(url))) }
                            catch (e: Exception) { Log.e(TAG, "tel: error: ${e.message}") }
                            true
                        }
                        url.startsWith("mailto:") -> {
                            try { startActivity(Intent(Intent.ACTION_SENDTO, Uri.parse(url))) }
                            catch (e: Exception) { Log.e(TAG, "mailto: error: ${e.message}") }
                            true
                        }
                        else -> false
                    }
                }

                // =============================================================
                // onPageFinished — inject persistent JWT polling script
                //
                // WHY POLLING INSTEAD OF DIRECT EXTRACTION:
                //   This is a React Single-Page App. onPageFinished fires ONCE
                //   when index.html loads (URL = root). After that, React Router
                //   handles all navigation client-side via history.pushState —
                //   onPageFinished is NEVER called again. So reading localStorage
                //   at page load always finds nothing (user hasn't logged in yet).
                //
                // THE FIX — inject a self-contained JS polling interval:
                //   The script runs inside the WebView's own JavaScript context,
                //   checks localStorage every second, and the instant the user
                //   logs in and AuthProvider writes 'bz_delivery_token', the
                //   script calls window.AndroidBridge.saveAuthToken(token).
                //   This works with ANY frontend version — no redeployment needed.
                // =============================================================
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    Log.i(FCM_TAG, "onPageFinished: url=$url — injecting JWT poll script")

                    // Inject once. The guard flag window.__jwtPollActive prevents
                    // duplicate intervals if onPageFinished fires more than once.
                    view?.evaluateJavascript("""
                        (function() {
                            if (window.__jwtPollActive) { return; }
                            window.__jwtPollActive = true;
                            console.log('[JWT_POLL] Polling started for bz_delivery_token');

                            var STORAGE_KEY = 'bz_delivery_token';
                            var lastSent    = null;

                            var poll = setInterval(function() {
                                var token = localStorage.getItem(STORAGE_KEY);
                                if (!token || token === lastSent) { return; }

                                if (window.AndroidBridge &&
                                        typeof window.AndroidBridge.saveAuthToken === 'function') {
                                    console.log('[JWT_POLL] Token found (len=' + token.length + ') — calling saveAuthToken');
                                    window.AndroidBridge.saveAuthToken(token);
                                    lastSent = token;
                                    console.log('[JWT_POLL] saveAuthToken dispatched ✓');
                                } else {
                                    console.warn('[JWT_POLL] AndroidBridge not ready yet — will retry');
                                }
                            }, 1000);

                            console.log('[JWT_POLL] Poll interval registered (every 1 s)');
                        })();
                    """.trimIndent(), null)
                }
            }   // end webViewClient

            addJavascriptInterface(AndroidBridge(), "AndroidBridge")
            Log.i(FCM_TAG, "─────────────────────────────────────────")
            Log.i(FCM_TAG, "AndroidBridge REGISTERED ✓ — window.AndroidBridge is available to JavaScript")
            Log.i(FCM_TAG, "Methods: saveAuthToken, syncToken, checkPendingNavigation, onLogout, postMessage")
            Log.i(FCM_TAG, "─────────────────────────────────────────")
        }

        setContentView(webView)

        // ── Step 3: handle notification deep link / load root URL ────────
        handleIntent(intent)

        // ── Step 4: fetch & cache FCM token ──────────────────────────────
        fetchFcmToken()
    }

    // =========================================================================
    // onNewIntent — notification tapped while app is already open
    // =========================================================================
    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        Log.d(TAG, "onNewIntent: received")
        handleIntent(intent)
    }

    // =========================================================================
    // onResume — retry token sync in case it failed on first attempt
    // (e.g. network unavailable during onCreate, or JWT arrived after FCM token)
    // =========================================================================
    override fun onResume() {
        super.onResume()
        val prefs     = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val authToken = prefs.getString(KEY_AUTH_TOKEN, null)
        val fcmToken  = prefs.getString(KEY_FCM_TOKEN, null)

        if (!authToken.isNullOrBlank() && !fcmToken.isNullOrBlank()) {
            Log.d(FCM_TAG, "onResume: JWT + FCM both present — retrying backend sync")
            sendTokenToBackend(fcmToken)
        } else {
            Log.d(FCM_TAG, "onResume: JWT=${if(authToken.isNullOrBlank()) "MISSING" else "present"} FCM=${if(fcmToken.isNullOrBlank()) "MISSING" else "present"} — skipping retry")
        }
    }

    // =========================================================================
    // onRequestPermissionsResult — permission dialog result callback
    // =========================================================================
    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == PERM_REQUEST_CODE) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                Log.i(FCM_TAG, "NOTIFICATION_PERMISSION: Granted ✓")
            } else {
                Log.w(FCM_TAG, "NOTIFICATION_PERMISSION: Denied")
            }
        }
    }

    // =========================================================================
    // Deep link handling
    // =========================================================================
    private fun handleIntent(intent: Intent?) {
        val type    = intent?.getStringExtra("type")
        val orderId = intent?.getStringExtra("order_id")
        Log.d(TAG, "handleIntent → type=$type orderId=$orderId")

        if (!type.isNullOrBlank() && !orderId.isNullOrBlank()) {
            getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
                .putString(KEY_PENDING_ORDER_ID, orderId)
                .putString(KEY_PENDING_TYPE, type)
                .apply()
        }
        webView.loadUrl(ROOT_URL)
    }

    // =========================================================================
    // Navigate to pending deep link via JS (called from AndroidBridge)
    // =========================================================================
    private fun navigateToPendingDeepLink() {
        val prefs   = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val orderId = prefs.getString(KEY_PENDING_ORDER_ID, null)
        val type    = prefs.getString(KEY_PENDING_TYPE, null)

        if (!orderId.isNullOrBlank() && !type.isNullOrBlank()) {
            Log.d(TAG, "navigateToPendingDeepLink → orderId=$orderId type=$type")
            prefs.edit().remove(KEY_PENDING_ORDER_ID).remove(KEY_PENDING_TYPE).apply()

            val route = "/delivery/orders/$orderId"
            webView.post {
                webView.evaluateJavascript("""
                    (function() {
                        try {
                            window.history.pushState({}, '', '$route');
                            window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
                            console.log('[AndroidBridge] Navigated to $route');
                        } catch(e) {
                            console.error('[AndroidBridge] Deep link nav error:', e);
                        }
                    })();
                """.trimIndent(), null)
            }
        }
    }

    // =========================================================================
    // FCM Token — Fetch → Cache → Send to backend
    // =========================================================================
    private fun fetchFcmToken() {
        Log.d(FCM_TAG, "fetchFcmToken: Requesting token from Firebase SDK...")
        FirebaseMessaging.getInstance().token
            .addOnCompleteListener { task ->
                if (!task.isSuccessful) {
                    Log.e(FCM_TAG, "TOKEN FETCH FAILED — ${task.exception?.message}")
                    return@addOnCompleteListener
                }
                val token = task.result
                if (token.isNullOrBlank()) {
                    Log.e(FCM_TAG, "TOKEN IS NULL OR BLANK")
                    return@addOnCompleteListener
                }
                Log.i(FCM_TAG, "TOKEN GENERATED SUCCESSFULLY ✓")
                Log.i(FCM_TAG, "TOKEN = $token")

                val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                prefs.edit().putString(KEY_FCM_TOKEN, token).apply()
                Log.d(FCM_TAG, "TOKEN cached in SharedPreferences ✓")

                sendTokenToBackend(token)
            }
    }

    // =========================================================================
    // Send FCM token to backend API
    // =========================================================================
    private fun sendTokenToBackend(fcmToken: String) {
        val prefs     = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val authToken = prefs.getString(KEY_AUTH_TOKEN, null)

        Log.d(FCM_TAG, "sendTokenToBackend: Checking JWT...")

        if (authToken.isNullOrBlank()) {
            Log.w(FCM_TAG, "sendTokenToBackend: JWT is NULL/EMPTY — skipping backend save")
            Log.w(FCM_TAG, "sendTokenToBackend: FCM token CACHED — will send after login")
            Log.w(FCM_TAG, "sendTokenToBackend: ACTION REQUIRED — web app must call:")
            Log.w(FCM_TAG, "  window.AndroidBridge.saveAuthToken(yourJwtToken)")
            return
        }

        Log.d(FCM_TAG, "sendTokenToBackend: JWT present ✓ (length=${authToken.length})")
        Log.d(FCM_TAG, "sendTokenToBackend: Sending → ${API_URL}api/delivery/push-token")

        val json = """{"token":"$fcmToken","device_id":"android","platform":"android"}"""
        val body = json.toRequestBody("application/json; charset=utf-8".toMediaType())

        val request = Request.Builder()
            .url("${API_URL}api/delivery/push-token")
            .addHeader("Authorization", "Bearer $authToken")
            .addHeader("Content-Type", "application/json")
            .post(body)
            .build()

        httpClient.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e(FCM_TAG, "sendTokenToBackend: NETWORK FAILURE — ${e.message}")
            }
            override fun onResponse(call: Call, response: Response) {
                response.use { resp ->
                    val body = resp.body?.string() ?: "(empty)"
                    if (resp.isSuccessful) {
                        Log.i(FCM_TAG, "sendTokenToBackend: SUCCESS ✓ HTTP ${resp.code}")
                        Log.i(FCM_TAG, "sendTokenToBackend: Response → $body")
                        Log.i(FCM_TAG, "FCM token NOW SAVED in delivery_notification_tokens ✓")
                    } else {
                        Log.e(FCM_TAG, "sendTokenToBackend: FAILED — HTTP ${resp.code} → $body")
                        Log.e(FCM_TAG, "  → ${when(resp.code){
                            401  -> "401 UNAUTHORIZED: JWT invalid/expired"
                            422  -> "422 VALIDATION: Token payload malformed"
                            500  -> "500 SERVER ERROR: Backend DB issue"
                            else -> "Unexpected error ${resp.code}"
                        }}")
                    }
                }
            }
        })
    }

    // =========================================================================
    // Android 13+ runtime notification permission — requested ONCE only
    // Uses simple requestPermissions() with result in onRequestPermissionsResult
    // =========================================================================
    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    == PackageManager.PERMISSION_GRANTED) {
                Log.d(FCM_TAG, "NOTIFICATION_PERMISSION: Already granted ✓")
                return
            }
            if (permissionRequested) {
                Log.d(FCM_TAG, "NOTIFICATION_PERMISSION: Already requested — skipping duplicate")
                return
            }
            permissionRequested = true
            Log.d(FCM_TAG, "NOTIFICATION_PERMISSION: Requesting (Android 13+ / API ${Build.VERSION.SDK_INT})")
            requestPermissions(
                arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                PERM_REQUEST_CODE
            )
        } else {
            Log.d(FCM_TAG, "NOTIFICATION_PERMISSION: Not required on Android < 13 — auto-granted ✓")
        }
    }

    // =========================================================================
    // JavaScript Bridge — window.AndroidBridge.*
    // =========================================================================
    inner class AndroidBridge {

        @JavascriptInterface
        fun saveAuthToken(token: String) {
            if (token.isBlank()) {
                Log.e(FCM_TAG, "AndroidBridge.saveAuthToken: RECEIVED BLANK JWT — ignoring")
                return
            }
            Log.i(FCM_TAG, "AndroidBridge.saveAuthToken: JWT received from WebView ✓ (length=${token.length})")

            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putString(KEY_AUTH_TOKEN, token).apply()
            Log.i(FCM_TAG, "AndroidBridge.saveAuthToken: JWT saved to SharedPreferences ✓")

            // Always fetch fresh FCM token from Firebase and sync to backend.
            // Using fetchFcmToken() ensures:
            //  1. We always have the LATEST token (not a potentially stale cache)
            //  2. sendTokenToBackend() inside fetchFcmToken() uses the JWT we just saved
            val cachedFcmToken = prefs.getString(KEY_FCM_TOKEN, null)
            if (!cachedFcmToken.isNullOrBlank()) {
                Log.i(FCM_TAG, "AndroidBridge.saveAuthToken: Cached FCM token found — syncing to backend immediately")
                sendTokenToBackend(cachedFcmToken)
            }
            // Always also request a fresh token to guarantee latest
            Log.d(FCM_TAG, "AndroidBridge.saveAuthToken: Requesting fresh FCM token from Firebase")
            fetchFcmToken()
        }

        @JavascriptInterface
        fun checkPendingNavigation() {
            Log.d(TAG, "AndroidBridge.checkPendingNavigation called")
            navigateToPendingDeepLink()
        }

        @JavascriptInterface
        fun syncToken() {
            Log.d(FCM_TAG, "AndroidBridge.syncToken: Manual sync triggered")
            fetchFcmToken()
        }

        @JavascriptInterface
        fun onLogout() {
            Log.d(TAG, "AndroidBridge.onLogout: Clearing JWT and FCM cache")
            getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
                .remove(KEY_AUTH_TOKEN)
                .remove(KEY_FCM_TOKEN)
                .remove(KEY_PENDING_ORDER_ID)
                .remove(KEY_PENDING_TYPE)
                .apply()
            Log.d(TAG, "AndroidBridge.onLogout: SharedPreferences cleared ✓")
        }

        @JavascriptInterface
        fun postMessage(message: String) {
            Log.d(TAG, "AndroidBridge.postMessage: $message")
        }
    }
}
