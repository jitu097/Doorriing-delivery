import { useState, useEffect, useCallback } from 'react';

// Module-level singleton so multiple consumers share the same prompt reference
// across React renders and component remounts.
let _deferredPrompt = null;

/**
 * Tracks the browser's `beforeinstallprompt` event and exposes
 * `install()` / `dismiss()` helpers.
 *
 * Returns:
 *   isInstallable – true when the install prompt is available
 *   install()     – triggers the native install dialog
 *   dismiss()     – hides the install button without installing
 */
export function usePWAInstall() {
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    // Already running as a standalone PWA — no install prompt needed
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Restore prompt if it was captured before this component mounted
    if (_deferredPrompt) setIsInstallable(true);

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      _deferredPrompt = e;
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      _deferredPrompt = null;
      setIsInstallable(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!_deferredPrompt) return;
    _deferredPrompt.prompt();
    const { outcome } = await _deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      _deferredPrompt = null;
      setIsInstallable(false);
    }
  }, []);

  const dismiss = useCallback(() => {
    _deferredPrompt = null;
    setIsInstallable(false);
  }, []);

  return { isInstallable, install, dismiss };
}
