# Android & Web "Bridge" Connection Guide

This guide explains how the **BazarSe Android App** was created using a "Native Wrapper" strategy and how it communicates with the **Web Application**. This pattern is ideal for converting any web app (PWA) into a native-feeling mobile app with Google Login and Push Notifications.

---

## 1. High-Level Architecture

The app follows a **Hybrid WebView Shell** pattern:
*   **Web App**: The React application (Vite-based) is hosted at `https://doorriing.com`. It owns 99% of the UI and business logic.
*   **Android Shell**: A thin native layer (Kotlin) that hosts the web app inside a `WebView`, handles the "Splash Screen," and provides access to native hardware features (like Push Notifications).

---

## 2. The JavaScript Bridge (`AndroidAuth`)

The "Bridge" is how the Web (JavaScript) and Android (Kotlin) talk to each other.

### A. Exposing Native to Web
In `MainActivity.kt`, we define a class with the `@JavascriptInterface` annotation and bind it to the WebView.

```kotlin
// Android Side (Kotlin)
private inner class AndroidAuthBridge {
    @JavascriptInterface
    fun startGoogleSignIn() {
        runOnUiThread { startNativeGoogleSignIn() }
    }

    @JavascriptInterface
    fun saveAuthToken(token: String?) {
        // Store token for notification sync
    }
}

// Bind it
webView.addJavascriptInterface(AndroidAuthBridge(), "AndroidAuth")
```

### B. Calling Native from Web
In your React code, you can now check for this bridge and call it:

```javascript
// Web Side (JavaScript)
if (window.AndroidAuth) {
  window.AndroidAuth.startGoogleSignIn();
}
```

---

## 3. Bidirectional Communication

| Direction | Mechanism | Example Use Case |
| :--- | :--- | :--- |
| **Web -> Native** | `window.AndroidAuth.method()` | Requesting Google Sign-In, saving an auth token. |
| **Native -> Web** | `webView.evaluateJavascript()` | Sending Google login results back to React. |

**Example of Native calling Web:**
```kotlin
val script = "window.onNativeGoogleLoginSuccess('$idToken');"
webView.evaluateJavascript(script, null)
```

---

## 4. Native Google Sign-In Flow

We use Native Google Login instead of web-based login because Google often blocks login attempts inside WebViews for security reasons.

1.  **Web** calls `window.AndroidAuth.startGoogleSignIn()`.
2.  **Android** launches the native Google Identity UI.
3.  **Android** receives the `idToken` from Google.
4.  **Android** signs into Firebase Natively to get a fresh Firebase ID Token.
5.  **Android** "injects" that token back into the web page.
6.  **Web** uses that token to finalize the session.

---

## 5. Notification & Deep Link Bridge

This is the most critical part for a "Real App" feel.

### A. FCM Token Synchronization
When a user logs in, the Android app registers for an FCM (Firebase Cloud Messaging) token and sends it to your backend API.
*   **Why?** So the backend knows which `device_id` belongs to which `user_id`.
*   **Implementation**: `syncFcmTokenToBackend` in `MainActivity.kt` calls your `/api/delivery/push-token` endpoint.

### B. Handling Incoming Notifications (Intent Extras)
When a notification is tapped, Android opens the app and passes "Extras" (data package).

```kotlin
// MainActivity.kt - Mapping data to URLs
private fun navigateFromNotification(type: String, referenceId: String?) {
    val urlToLoad = when (type) {
        "order_accepted" -> "$BASE_URL/orders/$referenceId"
        "offer" -> "$BASE_URL/offers"
        else -> BASE_URL
    }
    webView.loadUrl(urlToLoad)
}
```

### C. Backend Trigger
The backend (Node.js) uses the `firebase-admin` SDK to send messages with `priority: 'high'`. This ensures the notification arrives even if the app is killed.

---

## 6. How to Repeat This for Other Apps

If you want to make another web app into an app, follow these steps:

1.  **Host the Web App**: Ensure your site is mobile-responsive and hosted (e.g., Vercel, Firebase Hosting).
2.  **Create Android Project**: Use a basic "Empty Activity" template in Android Studio.
3.  **Add WebView**: Set up the `WebView` with these essential settings:
    *   `javaScriptEnabled = true`
    *   `domStorageEnabled = true`
    *   `addJavascriptInterface(...)`
4.  **Add Firebase**: Connect the Android project to a Firebase project for FCM.
5.  **Copy the Bridge**: Implement the login and token sync logic between your Web `AuthContext` and the Android `MainActivity`.
6.  **Setup Deep Links**: Ensure your backend sends `type` and `id` in the notification payload so Android can route the user to the correct page.

---

> [!TIP]
> **Performance Tip**: Use a "Splash Screen" (Activity) that lasts 1-2 seconds. This hides the initial loading time of the WebView and makes the app feel "Native" from the first tap.

> [!IMPORTANT]
> **Security**: Always use `EncryptedSharedPreferences` on the Android side to store sensitive tokens. Don't trust the WebView's cookie storage alone for native features.
