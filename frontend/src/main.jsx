import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './main.css';

// ─── Startup: Prune ONLY genuinely expired tokens ─────────────────────────────
// This runs once before React mounts.  It removes a stored token ONLY when we
// can confirm it is expired.  Any parse error → keep the token (AuthProvider
// will validate it again and clear it if needed, avoiding a false logout).
(function pruneExpiredTokens() {
  const keys = ['bz_admin_token', 'bz_delivery_token'];
  keys.forEach((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const part    = raw.split('.')[1];
      const padded  = part.replace(/-/g, '+').replace(/_/g, '/')
        .padEnd(part.length + (4 - (part.length % 4)) % 4, '=');
      const payload = JSON.parse(atob(padded));

      // Only remove if we KNOW it is expired (exp present AND past)
      if (payload.exp && payload.exp * 1000 <= Date.now()) {
        localStorage.removeItem(key);
        console.log(`[LOGIN_PERSIST] Startup: removed expired token for key=${key}`);
      }
      // Otherwise: keep the token — AuthProvider will validate it on mount
    } catch {
      // Cannot parse → leave token in place; AuthProvider will handle it
      console.warn(`[LOGIN_PERSIST] Startup: could not parse ${key} — leaving in place`);
    }
  });
})();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);