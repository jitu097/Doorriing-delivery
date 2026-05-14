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
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.firebase.FirebaseApp
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
        // ─── Log tags ────────────────────────────────────────────────────────
        // Filter ALL FCM logs with:           adb logcat -s FCM_DEBUG
        // Filter login-persistence logs with: adb logcat -s LOGIN_PERSIST
        private const val TAG          = "MainActivity"
        private const val FCM_TAG      = "FCM_DEBUG"
        private const val PERSIST_TAG  = "LOGIN_PERSIST"

        // ─── Network ─────────────────────────────────────────────────────────
        private const val ROOT_URL = "https://delivery.doorriing.com/"

        // ─── SharedPreferences ───────────────────────────────────────────────
        private const val PREFS_NAME           = "doorriing_prefs"
        private const val KEY_AUTH_TOKEN       = "auth_token"
        private const val KEY_FCM_TOKEN        = "fcm_token"
        private const val KEY_PENDING_ORDER_ID = "pending_order_id"
        private const val KEY_PENDING_TYPE     = "pending_type"
    }

    private lateinit var webView: WebView
    private val httpClient = OkHttpClient()

    // =========================================================================
    // Notification permission launcher — MUST be declared before onCreate()
    // =========================================================================
    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { isGranted ->
            if (isGranted) {
                Log.i(FCM_TAG, "NOTIFICATION_PERMISSION: Permission granted ✓")
                // Re-fetch token now that permission is granted
                fetchFcmToken()
            } else {
                Log.w(FCM_TAG, "NOTIFICATION_PERMISSION: Permission denied — " +
                        "notifications will NOT appear on lock screen/home screen")
            }
        }

    // =========================================================================
    // onCreate
    // =========================================================================
    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // ── STARTUP CANARY ────────────────────────────────────────────────────
        // These MUST appear in logcat if the new APK is installed and running.
        // Run: adb logcat -s FCM_DEBUG
        // If you do NOT see these lines → you are still running the OLD APK.
        Log.e(FCM_TAG, "════════════════════════════════════════")
        Log.e(FCM_TAG, "  DOORRIING DELIVERY v1.4 STARTING      ")
        Log.e(FCM_TAG, "  Android API: ${Build.VERSION.SDK_INT}  ")
        Log.e(FCM_TAG, "  Device: ${Build.MANUFACTURER} ${Build.MODEL}")
        Log.e(FCM_TAG, "════════════════════════════════════════")

        // ── STEP 0: Enable persistent cookie storage ──────────────────────────
        // MUST be called before any WebView is created.
        // Prevents Android from wiping cookies / localStorage on each launch.
        val cookieMgr = CookieManager.getInstance()
        cookieMgr.setAcceptCookie(true)
        Log.i(PERSIST_TAG, "Cookie persistence enabled ✓")

        // ── STEP 1: Verify Firebase is initialized ────────────────────────────
        verifyFirebaseInit()

        // ── STEP 2: Request notification permission (Android 13+) ─────────────
        requestNotificationPermissionIfNeeded()

        // ── STEP 3: WebView setup ─────────────────────────────────────────────
        webView = WebView(this).apply {
            // ── JavaScript & Storage ──────────────────────────────────────────
            settings.javaScriptEnabled              = true
            settings.domStorageEnabled              = true   // localStorage / sessionStorage
            settings.databaseEnabled                = true   // Web SQL (legacy, but safe)
            settings.allowFileAccessFromFileURLs    = false
            settings.allowUniversalAccessFromFileURLs = false

            // Allow third-party cookies inside this WebView (required for session cookies)
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
            Log.i(PERSIST_TAG, "WebView third-party cookies enabled ✓")

            // Suppress deprecation for saveFormData — still needed on API < 26
            @Suppress("DEPRECATION")
            settings.saveFormData = true

            webViewClient = object : WebViewClient() {

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    // Flush cookie store to disk so they survive process death
                    CookieManager.getInstance().flush()
                    Log.d(PERSIST_TAG, "onPageFinished: cookies flushed to disk ✓")
                }

                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    request: WebResourceRequest?
                ): Boolean {
                    val url = request?.url?.toString() ?: return false

                    return when {
                        // ── intent:// payment apps (Razorpay, PhonePe, GPay, Paytm)
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

                        // ── tel: phone dialer
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

                        else -> false
                    }
                }
            }

            addJavascriptInterface(AndroidBridge(), "AndroidBridge")
        }

        setContentView(webView)

        // ── STEP 4: Handle notification deep-link or load base URL ────────────
        handleIntent(intent)

        // ── STEP 5: Fetch FCM token ───────────────────────────────────────────
        fetchFcmToken()
    }

    // =========================================================================
    // onNewIntent — app already open, notification tapped
    // =========================================================================
    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        Log.d(TAG, "onNewIntent received")
        handleIntent(intent)
    }

    // =========================================================================
    // Verify Firebase is properly initialized
    // =========================================================================
    private fun verifyFirebaseInit() {
        try {
            val apps = FirebaseApp.getApps(this)
            Log.i(FCM_TAG, "FIREBASE_INIT: FirebaseApp instances found: ${apps.size}")
            if (apps.isEmpty()) {
                Log.e(FCM_TAG, "FIREBASE_INIT: ⚠ NO FIREBASE APPS — google-services.json not applied!")
                Log.e(FCM_TAG, "FIREBASE_INIT: Check that google-services plugin is applied in build.gradle")
            } else {
                apps.forEach { app ->
                    Log.i(FCM_TAG, "FIREBASE_INIT: App name='${app.name}' options.projectId='${app.options.projectId}'")
                }
                Log.i(FCM_TAG, "FIREBASE_INIT: Firebase initialized correctly ✓")
            }
        } catch (e: Exception) {
            Log.e(FCM_TAG, "FIREBASE_INIT: EXCEPTION during init check → ${e.javaClass.name}: ${e.message}")
        }
    }

    // =========================================================================
    // Deep-link intent handling
    // Always load ROOT_URL — React SPA routing via JS pushState after mount
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
    // Navigate to pending deep-link via JS (called from web after React mounts)
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
    // FCM Token — fetch from Firebase SDK, cache locally, send to backend
    //
    // Token is CACHED in SharedPreferences so it can be sent the moment a
    // JWT becomes available (via AndroidBridge.saveAuthToken) without needing
    // another round-trip to the Firebase SDK.
    // =========================================================================
    private fun fetchFcmToken() {
        Log.d(FCM_TAG, "fetchFcmToken: Requesting token from Firebase SDK...")
        Log.d(FCM_TAG, "fetchFcmToken: Stored JWT present = ${
            !getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .getString(KEY_AUTH_TOKEN, null).isNullOrBlank()
        }")

        try {
            FirebaseMessaging.getInstance().token
                .addOnCompleteListener { task ->
                    if (!task.isSuccessful) {
                        Log.e(FCM_TAG, "TOKEN FETCH FAILED ✗")
                        Log.e(FCM_TAG, "  exception type : ${task.exception?.javaClass?.name}")
                        Log.e(FCM_TAG, "  message        : ${task.exception?.message}")
                        Log.e(FCM_TAG, "  cause          : ${task.exception?.cause}")
                        Log.e(FCM_TAG, "  Possible fixes :")
                        Log.e(FCM_TAG, "    1. google-services.json missing or wrong package_name")
                        Log.e(FCM_TAG, "    2. google-services plugin not applied in build.gradle")
                        Log.e(FCM_TAG, "    3. No Google Play Services on device (use real device)")
                        Log.e(FCM_TAG, "    4. SHA-1 not registered in Firebase Console")
                        return@addOnCompleteListener
                    }

                    val token = task.result
                    if (token.isNullOrBlank()) {
                        Log.e(FCM_TAG, "TOKEN IS NULL OR BLANK — Firebase returned empty string")
                        return@addOnCompleteListener
                    }

                    Log.i(FCM_TAG, "════════════════════════════════════════")
                    Log.i(FCM_TAG, "TOKEN GENERATED SUCCESSFULLY ✓")
                    Log.i(FCM_TAG, "TOKEN = $token")
                    Log.i(FCM_TAG, "════════════════════════════════════════")

                    // Cache the token — survives until JWT becomes available
                    getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                        .edit().putString(KEY_FCM_TOKEN, token).apply()
                    Log.d(FCM_TAG, "TOKEN cached in SharedPreferences ✓")

                    // Attempt backend save (only works if JWT is present)
                    sendTokenToBackend(token)
                }
        } catch (e: Exception) {
            Log.e(FCM_TAG, "fetchFcmToken: EXCEPTION — ${e.javaClass.name}: ${e.message}")
            Log.e(FCM_TAG, "fetchFcmToken: This usually means FirebaseApp was not initialized.")
            Log.e(FCM_TAG, "fetchFcmToken: Check google-services.json is in app/ directory")
        }
    }

    // =========================================================================
    // Send FCM token to backend
    // Requires JWT in SharedPreferences — set by AndroidBridge.saveAuthToken()
    // =========================================================================
    private fun sendTokenToBackend(fcmToken: String) {
        val prefs     = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val authToken = prefs.getString(KEY_AUTH_TOKEN, null)

        Log.d(FCM_TAG, "sendTokenToBackend: JWT present = ${!authToken.isNullOrBlank()}")

        if (authToken.isNullOrBlank()) {
            Log.w(FCM_TAG, "sendTokenToBackend: JWT is NULL — token CACHED, will send after login")
            Log.w(FCM_TAG, "sendTokenToBackend: ► Web app MUST call: window.AndroidBridge.saveAuthToken(jwt)")
            return
        }

        Log.d(FCM_TAG, "sendTokenToBackend: Sending to → ${ROOT_URL}api/delivery/push-token")
        Log.d(FCM_TAG, "sendTokenToBackend: JWT length   = ${authToken.length}")
        Log.d(FCM_TAG, "sendTokenToBackend: FCM length   = ${fcmToken.length}")

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
                    val respBody = resp.body?.string() ?: "(empty)"
                    if (resp.isSuccessful) {
                        Log.i(FCM_TAG, "sendTokenToBackend: SUCCESS ✓ HTTP ${resp.code}")
                        Log.i(FCM_TAG, "sendTokenToBackend: Token saved in DB → $respBody")
                    } else {
                        Log.e(FCM_TAG, "sendTokenToBackend: FAILED HTTP ${resp.code} → $respBody")
                        when (resp.code) {
                            401 -> Log.e(FCM_TAG, "  ► 401: JWT invalid/expired. User must re-login.")
                            422 -> Log.e(FCM_TAG, "  ► 422: Validation failed. Check request body.")
                            500 -> Log.e(FCM_TAG, "  ► 500: Server error. Check backend logs.")
                        }
                    }
                }
            }
        })
    }

    // =========================================================================
    // Android 13+ notification permission
    // =========================================================================
    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val state = ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            if (state != PackageManager.PERMISSION_GRANTED) {
                Log.d(FCM_TAG, "NOTIFICATION_PERMISSION: Requesting... (Android API ${Build.VERSION.SDK_INT})")
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            } else {
                Log.d(FCM_TAG, "NOTIFICATION_PERMISSION: Already granted ✓")
            }
        } else {
            Log.d(FCM_TAG, "NOTIFICATION_PERMISSION: Auto-granted on Android < 13 (API ${Build.VERSION.SDK_INT}) ✓")
        }
    }

    // =========================================================================
    // JavaScript Bridge — web app ↔ native Android
    // =========================================================================
    inner class AndroidBridge {

        /**
         * ► MUST be called by React app after successful login.
         *
         *   // In your React login success handler:
         *   if (window.AndroidBridge?.saveAuthToken) {
         *     window.AndroidBridge.saveAuthToken(jwtToken)
         *   }
         */
        @JavascriptInterface
        fun saveAuthToken(token: String) {
            if (token.isBlank()) {
                Log.e(FCM_TAG,     "AndroidBridge.saveAuthToken: BLANK JWT received — ignoring")
                Log.e(PERSIST_TAG, "Token saved — FAILED (blank token)")
                return
            }

            Log.i(FCM_TAG,     "AndroidBridge.saveAuthToken: JWT received ✓ (length=${token.length})")
            Log.i(PERSIST_TAG, "Token saved ✓ (length=${token.length})")

            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putString(KEY_AUTH_TOKEN, token).apply()
            Log.i(FCM_TAG,     "AndroidBridge.saveAuthToken: JWT saved to SharedPreferences ✓")
            Log.i(PERSIST_TAG, "Auto login success — JWT persisted in SharedPreferences")

            // Flush cookies so the session cookie is also persisted to disk
            CookieManager.getInstance().flush()
            Log.d(PERSIST_TAG, "Cookies flushed to disk after token save ✓")

            // Use cached FCM token if available, otherwise fetch fresh
            val cachedFcmToken = prefs.getString(KEY_FCM_TOKEN, null)
            if (!cachedFcmToken.isNullOrBlank()) {
                Log.i(FCM_TAG, "AndroidBridge.saveAuthToken: Found cached FCM token → sending to backend NOW")
                sendTokenToBackend(cachedFcmToken)
            } else {
                Log.d(FCM_TAG, "AndroidBridge.saveAuthToken: No cached token → fetching from Firebase")
                fetchFcmToken()
            }
        }

        /**
         * ► Call after React Router mounts to trigger pending navigation.
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
         * ► Manual FCM re-sync. Call after login if needed.
         *
         *   window.AndroidBridge?.syncToken?.()
         */
        @JavascriptInterface
        fun syncToken() {
            Log.d(FCM_TAG, "AndroidBridge.syncToken: Manual sync from web")
            fetchFcmToken()
        }

        /**
         * ► Call on logout to clear credentials.
         *
         *   window.AndroidBridge?.onLogout?.()
         */
        @JavascriptInterface
        fun onLogout() {
            Log.i(TAG,          "AndroidBridge.onLogout: Manual logout triggered")
            Log.i(PERSIST_TAG,  "Manual logout — clearing JWT, FCM token and pending navigation")
            getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
                .remove(KEY_AUTH_TOKEN)
                .remove(KEY_FCM_TOKEN)
                .remove(KEY_PENDING_ORDER_ID)
                .remove(KEY_PENDING_TYPE)
                .apply()
            // Flush to make sure cleared prefs hit disk immediately
            Log.i(PERSIST_TAG, "SharedPreferences cleared ✓")
        }

        /** General-purpose web → native message channel */
        @JavascriptInterface
        fun postMessage(message: String) {
            Log.d(TAG, "AndroidBridge.postMessage: $message")
        }
    }
}
