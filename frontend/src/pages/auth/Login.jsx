import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../config/constants';
import { Button } from '../../components/common/Button';
import './Login.css';

// ─── Android Bridge JWT handoff ───────────────────────────────────────────────
// Called ONLY after successful delivery login.
// Sends the JWT directly to native Android so it can link the FCM token.
//
// Uses a retry loop because on some devices window.AndroidBridge may not be
// registered by the JS engine in the first microtask after page load, but IS
// available within the first 500 ms of the WebView lifetime.
function sendJwtToAndroidBridge(token) {
  console.log('[LOGIN_PERSIST] ══════════════════════════════════');
  console.log('[LOGIN_PERSIST] sendJwtToAndroidBridge() called');
  console.log('[LOGIN_PERSIST] token length:', token ? token.length : 'NULL/EMPTY');

  if (!token) {
    console.error('[LOGIN_PERSIST] ❌ token is null/empty — skipping bridge call');
    return;
  }

  // Attempt immediately
  const attempt = (triesLeft) => {
    console.log(`[LOGIN_PERSIST] Bridge attempt (tries left: ${triesLeft})`);
    console.log('[LOGIN_PERSIST] typeof window.AndroidBridge:', typeof window.AndroidBridge);
    console.log('[LOGIN_PERSIST] window.AndroidBridge value:', window.AndroidBridge);

    if (window.AndroidBridge && typeof window.AndroidBridge.saveAuthToken === 'function') {
      console.log('[LOGIN_PERSIST] ✓ AndroidBridge.saveAuthToken IS available — calling now');
      window.AndroidBridge.saveAuthToken(token);
      console.log('[LOGIN_PERSIST] ✓ saveAuthToken call dispatched');

      // Also trigger syncToken so Android immediately re-sends any cached FCM token
      if (typeof window.AndroidBridge.syncToken === 'function') {
        console.log('[LOGIN_PERSIST] ✓ Calling AndroidBridge.syncToken()');
        window.AndroidBridge.syncToken();
        console.log('[LOGIN_PERSIST] ✓ syncToken call dispatched');
      } else {
        console.warn('[LOGIN_PERSIST] ⚠ AndroidBridge.syncToken not available (non-fatal)');
      }
      console.log('[LOGIN_PERSIST] ══════════════════════════════════');
      return; // success
    }

    // Bridge not ready yet
    console.warn('[LOGIN_PERSIST] ⚠ AndroidBridge not available on this attempt');
    if (triesLeft > 0) {
      console.log(`[LOGIN_PERSIST] Retrying in 300ms...`);
      setTimeout(() => attempt(triesLeft - 1), 300);
    } else {
      console.error('[LOGIN_PERSIST] ❌ AndroidBridge.saveAuthToken NOT found after all retries');
      console.error('[LOGIN_PERSIST] Running in browser (no Android) OR addJavascriptInterface not called');
      console.log('[LOGIN_PERSIST] ══════════════════════════════════');
    }
  };

  attempt(3); // try up to 4 times (immediate + 3 retries × 300 ms = up to 900 ms total)
}

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [genericError, setGenericError] = useState('');

  const { login, isLoading, error: authError, clearError: clearAuthError } = useAuth();

  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    clearAuthError();
    setGenericError('');

    console.log('[LOGIN_PERSIST] ── handleSubmit: trying admin login first');

    // Step 1: Try admin login
    const adminRes = await login({ email, password, type: 'admin' });
    if (adminRes.success) {
      console.log('[LOGIN_PERSIST] Admin login success — navigating to admin dashboard');
      navigate(ROUTES.admin.dashboard);
      return;
    }

    console.log('[LOGIN_PERSIST] ── Admin login failed — trying delivery login');

    // Step 2: Try delivery login
    const deliveryRes = await login({ email, password, type: 'delivery' });
    if (deliveryRes.success) {
      console.log('[LOGIN_PERSIST] ✓ Delivery login SUCCESS');

      // ── CRITICAL: Pass JWT to native Android bridge ──────────────────
      // AuthProvider.login() already stored the token in localStorage AND
      // called notifyAndroidLogin(). We call sendJwtToAndroidBridge() here
      // ADDITIONALLY as a direct call with full diagnostic logging so we
      // can confirm the bridge is reachable from this exact execution point.
      const storedToken = localStorage.getItem('bz_delivery_token');
      console.log('[LOGIN_PERSIST] JWT from localStorage:', storedToken ? `present (${storedToken.length} chars)` : 'MISSING');
      sendJwtToAndroidBridge(storedToken);
      // ─────────────────────────────────────────────────────────────────

      navigate(ROUTES.delivery.dashboard);
      return;
    }

    // Both failed
    console.warn('[LOGIN_PERSIST] Both admin and delivery login failed');
    setGenericError('Invalid credentials or account not found.');
  };

  const displayError = genericError || authError;

  return (
    <div className="auth-page auth-page--delivery">
      <div className="auth-card">
        <div className="auth-card__brand">
          <img src="/Doorriing.png" alt="Doorriing" className="auth-card__brand-logo" />
          <span className="auth-card__brand-name">Doorriing</span>
        </div>

        <h1 className="auth-card__title">Partner Portal</h1>
        <p className="auth-card__subtitle">Sign in to your account</p>

        <div className="auth-demo-boxes">
          <button
            type="button"
            className="auth-demo-box"
            onClick={() => { setEmail('admin@doorring.com'); setPassword('Admin@123'); }}
          >
            <p className="auth-demo-box__title">Admin Test <span className="auth-demo-box__hint">click to fill</span></p>
            <p><span>Email:</span> admin@doorring.com</p>
            <p><span>Password:</span> Admin@123</p>
          </button>
          <button
            type="button"
            className="auth-demo-box"
            onClick={() => { setEmail('delivery@doorring.com'); setPassword('Delivery@123'); }}
          >
            <p className="auth-demo-box__title">Delivery Test <span className="auth-demo-box__hint">click to fill</span></p>
            <p><span>Email:</span> delivery@doorring.com</p>
            <p><span>Password:</span> Delivery@123</p>
          </button>
        </div>

        {displayError && (
          <div className="alert alert--error" role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {displayError}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email address</label>
            <input
              className="form-input"
              type="email"
              placeholder="name@doorriing.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <Button type="submit" size="lg" isLoading={isLoading} className="auth-btn">
            Sign In
          </Button>
        </form>
      </div>
    </div>
  );
};
