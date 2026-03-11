import { memo } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import './InstallButton.css';

/**
 * Self-contained install button.
 * Renders nothing when the app is not installable (already installed,
 * browser doesn't support install prompts, or running in standalone mode).
 */
export const InstallButton = memo(() => {
  const { isInstallable, install } = usePWAInstall();

  if (!isInstallable) return null;

  return (
    <button
      className="install-btn"
      onClick={install}
      title="Install Doorriing App"
      aria-label="Install Doorriing App"
    >
      {/* Download-arrow icon */}
      <svg
        className="install-btn__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        width="15"
        height="15"
        aria-hidden="true"
      >
        <path d="M12 3v12" />
        <path d="M8 11l4 4 4-4" />
        <path d="M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2" />
      </svg>
      <span className="install-btn__label">Install App</span>
    </button>
  );
});
