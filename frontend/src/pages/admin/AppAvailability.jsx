import { useEffect, useState, useCallback, useRef } from 'react';
import { adminService } from '../../services/adminService';
import { Button } from '../../components/common/Button';
import { Loader } from '../../components/common/Loader';
import './AppAvailability.css';

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Formats an ISO timestamp in Indian locale */
const fmtDateTime = (iso) => {
  if (!iso) return null;
  return new Date(iso).toLocaleString('en-IN', {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
};

/** Converts "HH:MM" to "9:00 AM" display */
const fmtTime = (hhmm) => {
  if (!hhmm) return '—';
  const [hStr, mStr] = hhmm.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const period   = h < 12 ? 'AM' : 'PM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
};

/** Determines which CSS modifier to use for the status banner */
const bannerMod = (settings) => {
  if (!settings) return 'closed';
  if (!settings.is_app_enabled) return 'off';
  return settings.isCurrentlyOpen ? 'open' : 'closed';
};

// ─── Sub-components ────────────────────────────────────────────────────────────

/** Live status banner shown at the top of the page */
const StatusBanner = ({ settings }) => {
  if (!settings) return null;

  const mod      = bannerMod(settings);
  const isOpen   = settings.isCurrentlyOpen;
  const isOff    = !settings.is_app_enabled;

  const statusText = isOff
    ? 'App is OFF — Order placement blocked'
    : isOpen
    ? 'App is OPEN — Orders accepted normally'
    : `Outside delivery hours — ${settings.closedReason || 'Checkout blocked'}`;

  const badgeLabel = isOff ? 'CLOSED' : isOpen ? 'OPEN' : 'CLOSED';

  return (
    <div className={`avail-status-banner avail-status-banner--${mod} avail-fade-in`}>
      <span className={`avail-status-pulse avail-status-pulse--${mod}`} aria-hidden="true" />
      <div className="avail-status-text">
        <p className="avail-status-text__label">Current Live Status</p>
        <p className="avail-status-text__value">{statusText}</p>
        {settings.closedReason && !isOff && (
          <p className="avail-status-text__reason">{settings.closedReason}</p>
        )}
      </div>
      <span className={`avail-status-badge avail-status-badge--${mod}`}>{badgeLabel}</span>
    </div>
  );
};

/** Preview sidebar card showing computed live state */
const PreviewCard = ({ form, liveSettings }) => {
  // Preview uses the saved live settings, not the unsaved form state
  const s         = liveSettings;
  const isOpen    = s?.isCurrentlyOpen;
  const isEnabled = s?.is_app_enabled;

  return (
    <div className="avail-card avail-preview">
      <div className="avail-card__header">
        <div className="avail-card__icon avail-card__icon--preview">🔍</div>
        <div>
          <h2 className="avail-card__title">Live Preview</h2>
          <p className="avail-card__subtitle">Reflects saved settings</p>
        </div>
      </div>

      <div className="avail-card__body">
        {/* Status indicator */}
        <div
          className={`avail-preview-status avail-preview-status--${isOpen ? 'open' : 'closed'}`}
        >
          <span className={`avail-preview-dot avail-preview-dot--${isOpen ? 'open' : 'closed'}`} />
          <span className="avail-preview-status-text">
            {isOpen ? 'Orders Accepted' : 'Orders Blocked'}
          </span>
        </div>

        <div className="avail-preview-rows">
          {/* App toggle */}
          <div className="avail-preview-row">
            <span className="avail-preview-row__label">App Status</span>
            <span className={`avail-preview-row__value avail-preview-row__value--${isEnabled ? 'on' : 'off'}`}>
              {isEnabled ? '✅ Enabled' : '❌ Disabled'}
            </span>
          </div>

          {/* Delivery window */}
          <div className="avail-preview-row">
            <span className="avail-preview-row__label">Delivery Window</span>
            <span className="avail-preview-row__value">
              {s ? `${fmtTime(s.delivery_start_time)} – ${fmtTime(s.delivery_end_time)}` : '—'}
            </span>
          </div>

          {/* Blocked reason */}
          <div className="avail-preview-row">
            <span className="avail-preview-row__label">Blocked Reason</span>
            <span
              className={`avail-preview-row__value ${
                s?.closedReason ? '' : 'avail-preview-row__value--muted'
              }`}
            >
              {s?.closedReason || 'None — app is open'}
            </span>
          </div>

          {/* Last updated */}
          <div className="avail-preview-row">
            <span className="avail-preview-row__label">Last Updated</span>
            <span className="avail-preview-row__value avail-preview-row__value--muted">
              {s?.updated_at ? fmtDateTime(s.updated_at) : '—'}
            </span>
          </div>

          {/* Updated by */}
          {s?.updated_by && (
            <div className="avail-preview-row">
              <span className="avail-preview-row__label">Updated By</span>
              <span className="avail-preview-row__value avail-preview-row__value--muted">
                {s.updated_by}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Page Component ────────────────────────────────────────────────────────

export const AppAvailability = () => {
  const [liveSettings, setLiveSettings] = useState(null);
  const [form, setForm]                 = useState(null);
  const [isLoading, setIsLoading]       = useState(true);
  const [saving, setSaving]             = useState(false);
  const [successMsg, setSuccessMsg]     = useState(null);
  const [errorMsg, setErrorMsg]         = useState(null);

  const livePollerRef = useRef(null);

  // ── Fetch settings ─────────────────────────────────────────────────────────

  const loadSettings = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const data = await adminService.getAppAvailability();
      setLiveSettings(data);
      // Only populate the form on first load (don't overwrite unsaved edits)
      setForm((prev) =>
        prev === null
          ? {
              is_app_enabled:      data.is_app_enabled,
              delivery_start_time: data.delivery_start_time ?? '09:00',
              delivery_end_time:   data.delivery_end_time   ?? '23:00',
              maintenance_message: data.maintenance_message ?? '',
            }
          : prev
      );
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load + 30-second live preview poll
  useEffect(() => {
    loadSettings(true);

    // Poll live state (only liveSettings — not form, so unsaved edits are safe)
    livePollerRef.current = setInterval(async () => {
      try {
        const data = await adminService.getAppAvailability();
        setLiveSettings(data);
      } catch {
        // Silently ignore poll errors — stale preview is acceptable
      }
    }, 30_000);

    return () => {
      if (livePollerRef.current) clearInterval(livePollerRef.current);
    };
  }, [loadSettings]);

  // ── Form field handler ─────────────────────────────────────────────────────

  const setField = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
    // Clear messages on any edit
    setSuccessMsg(null);
    setErrorMsg(null);
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const payload = {
        is_app_enabled:      form.is_app_enabled,
        delivery_start_time: form.delivery_start_time,
        delivery_end_time:   form.delivery_end_time,
        maintenance_message: form.maintenance_message || null,
      };

      const updated = await adminService.updateAppAvailability(payload);
      setLiveSettings(updated);

      setSuccessMsg(
        updated.is_app_enabled
          ? '✅ Settings saved — User App is now OPEN.'
          : '⛔ Settings saved — User App is now CLOSED.'
      );
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────

  if (isLoading) return <Loader label="Loading availability settings..." />;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="avail-page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">App Availability</h1>
          <p className="page-subtitle">
            Control whether the User App accepts new orders and set delivery time windows.
          </p>
        </div>
      </div>

      {/* Live Status Banner */}
      <StatusBanner settings={liveSettings} />

      {/* Alert messages */}
      {errorMsg   && (
        <div className="avail-alert avail-alert--error avail-fade-in" role="alert">
          ⚠️ {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="avail-alert avail-alert--success avail-fade-in" role="status">
          {successMsg}
        </div>
      )}

      {/* Main layout: form + preview */}
      <form className="avail-layout" onSubmit={handleSave} noValidate>
        {/* ── Left Column: controls ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Card 1: Global Toggle */}
          <div className="avail-card">
            <div className="avail-card__header">
              <div className="avail-card__icon avail-card__icon--toggle">⚡</div>
              <div>
                <h2 className="avail-card__title">Global App Toggle</h2>
                <p className="avail-card__subtitle">Instantly open or close the User App</p>
              </div>
            </div>

            <div className="avail-card__body">
              <div className="avail-toggle-row">
                <div className="avail-toggle-info">
                  <p className="avail-toggle-info__title">Accept New Orders</p>
                  <p className="avail-toggle-info__desc">
                    When OFF, all new order placement is blocked immediately. Existing active
                    orders, payments, and deliveries are completely unaffected.
                  </p>
                </div>

                <div className="avail-toggle-wrap">
                  <span
                    className={`avail-toggle-label avail-toggle-label--${
                      form?.is_app_enabled ? 'on' : 'off'
                    }`}
                  >
                    {form?.is_app_enabled ? 'ON' : 'OFF'}
                  </span>

                  <label className="avail-toggle-switch" htmlFor="is_app_enabled" aria-label="Toggle app availability">
                    <input
                      id="is_app_enabled"
                      type="checkbox"
                      checked={form?.is_app_enabled ?? true}
                      onChange={setField('is_app_enabled')}
                    />
                    <span className="avail-toggle-track">
                      <span className="avail-toggle-thumb" />
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Delivery Time Window */}
          <div className="avail-card">
            <div className="avail-card__header">
              <div className="avail-card__icon avail-card__icon--clock">🕐</div>
              <div>
                <h2 className="avail-card__title">Delivery Time Window</h2>
                <p className="avail-card__subtitle">Orders outside this window are automatically blocked</p>
              </div>
            </div>

            <div className="avail-card__body">
              <div className="avail-time-grid">
                <div className="avail-form-group">
                  <label className="avail-form-label" htmlFor="delivery_start_time">
                    Start Time (IST)
                  </label>
                  <input
                    id="delivery_start_time"
                    type="time"
                    className="avail-form-input"
                    value={form?.delivery_start_time ?? '09:00'}
                    onChange={setField('delivery_start_time')}
                    required
                  />
                  <p className="avail-form-hint">Orders accepted from this time</p>
                </div>

                <div className="avail-form-group">
                  <label className="avail-form-label" htmlFor="delivery_end_time">
                    End Time (IST)
                  </label>
                  <input
                    id="delivery_end_time"
                    type="time"
                    className="avail-form-input"
                    value={form?.delivery_end_time ?? '23:00'}
                    onChange={setField('delivery_end_time')}
                    required
                  />
                  <p className="avail-form-hint">Orders blocked after this time</p>
                </div>
              </div>

              <p className="avail-form-hint" style={{ marginTop: '14px', padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border)' }}>
                🌏 All times are in <strong>Indian Standard Time (IST)</strong>. The server
                always computes the current time in IST regardless of server timezone.
              </p>

              {/* Overnight window indicator */}
              {(() => {
                const start = form?.delivery_start_time;
                const end   = form?.delivery_end_time;
                if (!start || !end) return null;
                const startMins = parseInt(start.split(':')[0], 10) * 60 + parseInt(start.split(':')[1], 10);
                const endMins   = parseInt(end.split(':')[0],   10) * 60 + parseInt(end.split(':')[1],   10);
                const isOvernight = endMins < startMins;
                if (!isOvernight) return null;
                const fmtT = (hhmm) => {
                  const [hS, mS] = hhmm.split(':');
                  const h = parseInt(hS, 10);
                  const period = h < 12 ? 'AM' : 'PM';
                  const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
                  return `${dh}:${mS} ${period}`;
                };
                return (
                  <div style={{ marginTop: '10px', padding: '10px 14px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>🌙</span>
                    <p style={{ fontSize: '0.8125rem', color: '#1d4ed8', margin: 0, lineHeight: 1.5 }}>
                      <strong>Overnight window detected.</strong> Your delivery window runs from{' '}
                      <strong>{fmtT(start)}</strong> until <strong>{fmtT(end)}</strong> the next day
                      (spans midnight). Orders will be accepted from {fmtT(start)} → 11:59 PM → {fmtT(end)}.
                      Closed only between {fmtT(end)} and {fmtT(start)}.
                    </p>
                  </div>
                );
              })()}

            </div>
          </div>

          {/* Card 3: Maintenance Message */}
          <div className="avail-card">
            <div className="avail-card__header">
              <div className="avail-card__icon avail-card__icon--msg">💬</div>
              <div>
                <h2 className="avail-card__title">User-Facing Message</h2>
                <p className="avail-card__subtitle">Shown to customers when the app is closed</p>
              </div>
            </div>

            <div className="avail-card__body">
              <div className="avail-form-group">
                <label className="avail-form-label" htmlFor="maintenance_message">
                  Maintenance Message
                </label>
                <textarea
                  id="maintenance_message"
                  className="avail-form-textarea"
                  value={form?.maintenance_message ?? ''}
                  onChange={setField('maintenance_message')}
                  placeholder="We are currently not accepting orders. Please try again later."
                  maxLength={300}
                />
                <p className="avail-form-hint">
                  {(form?.maintenance_message ?? '').length}/300 characters. Displayed on checkout
                  when the toggle is OFF.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Column: preview card ── */}
        <PreviewCard form={form} liveSettings={liveSettings} />

        {/* Save Footer — outside the grid so it spans both cols on mobile too */}
        <div className="avail-save-footer" style={{ gridColumn: '1 / -1' }}>
          <p className="avail-save-footer__meta">
            {liveSettings?.updated_at ? (
              <>Last saved: <strong>{fmtDateTime(liveSettings.updated_at)}</strong></>
            ) : (
              'No changes saved yet.'
            )}
          </p>
          <Button type="submit" isLoading={saving} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
};
