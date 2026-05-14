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
import androidx.activity.result.contract.ActivityResultContracts
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
        // ─── Log tags ───────────────────────────────────────────────────────
        private const val TAG     = "MainActivity"
        private const val FCM_TAG = "FCM_DEBUG"   // filter: adb logcat -s FCM_DEBUG

        // ─── URLs ───────────────────────────────────────────────────────────
        private const val ROOT_URL = "https://delivery.doorriing.com/"

        // ─── SharedPreferences keys ─────────────────────────────────────────
        private const val PREFS_NAME           = "doorriing_prefs"
        private const val KEY_AUTH_TOKEN       = "auth_token"
        private const val KEY_FCM_TOKEN        = "fcm_token"   // cached FCM token
        private const val KEY_PENDING_ORDER_ID = "pending_order_id"
        private const val KEY_PENDING_TYPE     = "pending_type"
    }

    private lateinit var webView: WebView
    private val httpClient = OkHttpClient()

    // =========================================================================
    // Android 13+ notification permission launcher
    // Registered BEFORE onCreate — required by ActivityResultContracts API
    // =========================================================================
    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { isGranted ->
            if (isGranted) {
                Log.i(FCM_TAG, "NOTIFICATION_PERMISSION: Permission granted ✓")
            } else {
                Log.w(FCM_TAG, "NOTIFICATION_PERMISSION: Permission denied — " +
                        "push notifications will not appear on lock screen/home screen")
            }
        }

    // =========================================================================
    // onCreate
    // =========================================================================
    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        Log.d(FCM_TAG, "─────────────────────────────────────────")
        Log.d(FCM_TAG, "MainActivity.onCreate() — app starting")
        Log.d(FCM_TAG, "Android SDK version: ${Build.VERSION.SDK_INT}")

        // ── Step 1: notification permission (Android 13+) ─────────────────
        requestNotificationPermissionIfNeeded()

        // ── Step 2: WebView setup ──────────────────────────────────────────
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
                        // ── intent:// — payment apps (Razorpay, PhonePe, GPay, Paytm)
                        url.startsWith("intent://") -> {
                            Log.d(TAG, "Intercepting intent:// → $url")
                            try {
                                val intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
                                if (packageManager.resolveActivity(intent, 0) != null) {
                                    startActivity(intent)
                                } else {
                                    val fallback = intent.getStringExtra("browser_fallback_url")
                                    if (!fallback.isNullOrBlank()) view?.loadUrl(fallback)
                                }
                            } catch (e: Exception) {
                                Log.e(TAG, "intent:// parse error: ${e.message}")
                            }
                            true
                        }

                        // ── tel: — phone dialer
                        url.startsWith("tel:") -> {
                            Log.d(TAG, "Intercepting tel: → $url")
                            try { startActivity(Intent(Intent.ACTION_DIAL, Uri.parse(url))) }
                            catch (e: Exception) { Log.e(TAG, "Dialer error: ${e.message}") }
                            true
                        }

                        // ── mailto:
                        url.startsWith("mailto:") -> {
                            Log.d(TAG, "Intercepting mailto: → $url")
                            try { startActivity(Intent(Intent.ACTION_SENDTO, Uri.parse(url))) }
                            catch (e: Exception) { Log.e(TAG, "Mail error: ${e.message}") }
                            true
                        }

                        // ── everything else stays in WebView
                        else -> false
                    }
                }
            }

            addJavascriptInterface(AndroidBridge(), "AndroidBridge")
        }

        setContentView(webView)

        // ── Step 3: load URL / handle notification deep link ──────────────
        handleIntent(intent)

        // ── Step 4: fetch and sync FCM token ──────────────────────────────
        //    Token is fetched from Firebase SDK and cached locally.
        //    It will be sent to the backend as soon as a JWT is available.
        fetchFcmToken()
    }

    // =========================================================================
    // onNewIntent — notification tapped while app is ALREADY OPEN
    // =========================================================================
    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        Log.d(TAG, "onNewIntent: received")
        handleIntent(intent)
    }

    // =========================================================================
    // Deep link handling
    //
    // Never load a sub-path directly — React SPA uses client-side routing.
    // Instead: load ROOT_URL, store the target route, web app calls
    // AndroidBridge.checkPendingNavigation() after React Router mounts,
    // which triggers window.history.pushState().
    // =========================================================================
    private fun handleIntent(intent: Intent?) {
        val type    = intent?.getStringExtra("type")
        val orderId = intent?.getStringExtra("order_id")
        Log.d(TAG, "handleIntent → type=$type orderId=$orderId")

        if (!type.isNullOrBlank() && !orderId.isNullOrBlank()) {
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putString(KEY_PENDING_ORDER_ID, orderId)
                .putString(KEY_PENDING_TYPE, type)
                .apply()
        }
        // Always load base URL — React Router handles the rest
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
    //
    // WHY we cache:
    //   Firebase SDK returns the token here.
    //   Backend requires a JWT to save it.
    //   On first launch the user isn't logged in yet, so JWT is missing.
    //   We cache the raw FCM token in SharedPreferences so that the MOMENT
    //   the JWT arrives (via AndroidBridge.saveAuthToken), we can send
    //   the cached token immediately without another Firebase SDK call.
    // =========================================================================
    private fun fetchFcmToken() {
        Log.d(FCM_TAG, "fetchFcmToken: Requesting token from Firebase SDK...")

        FirebaseMessaging.getInstance().token
            .addOnCompleteListener { task ->
                if (!task.isSuccessful) {
                    Log.e(FCM_TAG, "TOKEN FETCH FAILED — exception: ${task.exception}")
                    Log.e(FCM_TAG, "TOKEN FETCH FAILED — message: ${task.exception?.message}")
                    Log.e(FCM_TAG, "TOKEN FETCH FAILED — cause: ${task.exception?.cause}")
                    return@addOnCompleteListener
                }

                val token = task.result
                if (token.isNullOrBlank()) {
                    Log.e(FCM_TAG, "TOKEN IS NULL OR BLANK — Firebase returned empty token")
                    return@addOnCompleteListener
                }

                Log.i(FCM_TAG, "TOKEN GENERATED SUCCESSFULLY ✓")
                Log.i(FCM_TAG, "TOKEN = $token")

                // Cache the token — we'll need it when JWT becomes available
                val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                prefs.edit().putString(KEY_FCM_TOKEN, token).apply()
                Log.d(FCM_TAG, "TOKEN cached in SharedPreferences ✓")

                // Attempt to send to backend (only succeeds if JWT is stored)
                sendTokenToBackend(token)
            }
    }

    // =========================================================================
    // Send FCM token to backend API
    //
    // Requires: JWT in SharedPreferences (stored by AndroidBridge.saveAuthToken)
    // If no JWT → logs warning and returns. Token send will be retried by
    // AndroidBridge.saveAuthToken() → fetchFcmToken() when user logs in.
    // =========================================================================
    private fun sendTokenToBackend(fcmToken: String) {
        val prefs     = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val authToken = prefs.getString(KEY_AUTH_TOKEN, null)

        Log.d(FCM_TAG, "sendTokenToBackend: Checking JWT...")

        if (authToken.isNullOrBlank()) {
            Log.w(FCM_TAG, "sendTokenToBackend: JWT is NULL/EMPTY — skipping backend save")
            Log.w(FCM_TAG, "sendTokenToBackend: FCM token is CACHED and will be sent after login")
            Log.w(FCM_TAG, "sendTokenToBackend: ACTION REQUIRED — web app must call:")
            Log.w(FCM_TAG, "  window.AndroidBridge.saveAuthToken(yourJwtToken)")
            return
        }

        Log.d(FCM_TAG, "sendTokenToBackend: JWT present ✓ (length=${authToken.length})")
        Log.d(FCM_TAG, "sendTokenToBackend: FCM token length=${fcmToken.length}")
        Log.d(FCM_TAG, "sendTokenToBackend: Sending to → ${ROOT_URL}api/delivery/push-token")

        val json = """{"token":"$fcmToken","device_id":"android","platform":"android"}"""
        val body = json.toRequestBody("application/json; charset=utf-8".toMediaType())

        val request = Request.Builder()
            .url("${ROOT_URL}api/delivery/push-token")
            .addHeader("Authorization", "Bearer $authToken")
            .addHeader("Content-Type", "application/json")
            .post(body)
            .build()

        httpClient.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e(FCM_TAG, "sendTokenToBackend: NETWORK FAILURE — ${e.javaClass.simpleName}: ${e.message}")
            }

            override fun onResponse(call: Call, response: Response) {
                response.use { resp ->
                    val responseBody = resp.body?.string() ?: "(empty)"
                    if (resp.isSuccessful) {
                        Log.i(FCM_TAG, "sendTokenToBackend: SUCCESS ✓ HTTP ${resp.code}")
                        Log.i(FCM_TAG, "sendTokenToBackend: Response → $responseBody")
                        Log.i(FCM_TAG, "FCM token is NOW SAVED in delivery_notification_tokens ✓")
                    } else {
                        Log.e(FCM_TAG, "sendTokenToBackend: FAILED — HTTP ${resp.code}")
                        Log.e(FCM_TAG, "sendTokenToBackend: Response body → $responseBody")
                        
                        val code = resp.code
                        val errorDetail = when (code) {
                            401 -> "401 UNAUTHORIZED: JWT is invalid or expired. User must re-login."
                            422 -> "422 VALIDATION: Token payload is malformed."
                            500 -> "500 SERVER ERROR: Backend DB issue."
                            else -> "Unexpected Error: $code"
                        }
                        Log.e(FCM_TAG, "  → $errorDetail")
                    }
                }
            }
        })
    }

    // =========================================================================
    // Android 13+ runtime notification permission
    // =========================================================================
    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val state = ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            if (state != PackageManager.PERMISSION_GRANTED) {
                Log.d(FCM_TAG, "NOTIFICATION_PERMISSION: Requesting permission (Android 13+ / API ${Build.VERSION.SDK_INT})")
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            } else {
                Log.d(FCM_TAG, "NOTIFICATION_PERMISSION: Already granted ✓")
            }
        } else {
            Log.d(FCM_TAG, "NOTIFICATION_PERMISSION: Not required on Android < 13 (API ${Build.VERSION.SDK_INT}) — auto-granted ✓")
        }
    }

    // =========================================================================
    // JavaScript Bridge
    // Web app communicates with native Android via window.AndroidBridge.*
    // =========================================================================
    inner class AndroidBridge {

        /**
         * ▶ MUST be called by React app immediately after successful login.
         *
         * This is the KEY integration point. Without this call, the FCM token
         * cannot be sent to the backend (JWT is required by the push-token API).
         *
         * Add this to your React login success handler:
         *   if (window.AndroidBridge?.saveAuthToken) {
         *     window.AndroidBridge.saveAuthToken(jwtToken)
         *   }
         */
        @JavascriptInterface
        fun saveAuthToken(token: String) {
            if (token.isBlank()) {
                Log.e(FCM_TAG, "AndroidBridge.saveAuthToken: RECEIVED BLANK JWT — ignoring")
                return
            }

            Log.i(FCM_TAG, "AndroidBridge.saveAuthToken: JWT received ✓ (length=${token.length})")

            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putString(KEY_AUTH_TOKEN, token).apply()

            Log.i(FCM_TAG, "AndroidBridge.saveAuthToken: JWT saved to SharedPreferences ✓")

            // Check if we already have a cached FCM token — send it now
            val cachedFcmToken = prefs.getString(KEY_FCM_TOKEN, null)
            if (!cachedFcmToken.isNullOrBlank()) {
                Log.i(FCM_TAG, "AndroidBridge.saveAuthToken: Found cached FCM token — sending to backend NOW")
                sendTokenToBackend(cachedFcmToken)
            } else {
                Log.d(FCM_TAG, "AndroidBridge.saveAuthToken: No cached FCM token yet — fetching from Firebase")
                fetchFcmToken()
            }
        }

        /**
         * ▶ Call this after React Router is mounted.
         * Triggers navigation to pending deep-link order (from notification tap).
         *
         *   useEffect(() => {
         *     window.AndroidBridge?.checkPendingNavigation?.()
         *   }, [])
         */
        @JavascriptInterface
        fun checkPendingNavigation() {
            Log.d(TAG, "AndroidBridge.checkPendingNavigation called")
            navigateToPendingDeepLink()
        }

        /**
         * ▶ Manual FCM token re-sync trigger.
         * Call after login if saveAuthToken was called before the token was ready.
         *
         *   window.AndroidBridge?.syncToken?.()
         */
        @JavascriptInterface
        fun syncToken() {
            Log.d(FCM_TAG, "AndroidBridge.syncToken: Manual sync triggered from web")
            fetchFcmToken()
        }

        /**
         * ▶ Call on logout to clear stored credentials.
         *
         *   window.AndroidBridge?.onLogout?.()
         */
        @JavascriptInterface
        fun onLogout() {
            Log.d(TAG, "AndroidBridge.onLogout: Clearing stored JWT and FCM cache")
            getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
                .remove(KEY_AUTH_TOKEN)
                .remove(KEY_FCM_TOKEN)
                .remove(KEY_PENDING_ORDER_ID)
                .remove(KEY_PENDING_TYPE)
                .apply()
            Log.d(TAG, "AndroidBridge.onLogout: SharedPreferences cleared ✓")
        }

        /**
         * ▶ General-purpose message channel from web app.
         */
        @JavascriptInterface
        fun postMessage(message: String) {
            Log.d(TAG, "AndroidBridge.postMessage: $message")
        }
    }
}
