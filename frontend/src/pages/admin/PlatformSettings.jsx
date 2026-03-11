import { useEffect, useState } from 'react';
import { adminService } from '../../services/adminService';
import { Button } from '../../components/common/Button';
import { Loader } from '../../components/common/Loader';
import './PlatformSettings.css';

const fmt = (v) => `₹${Number(v || 0).toFixed(2)}`;

const fmtDateTime = (iso) => {
  if (!iso) return null;
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

export const PlatformSettings = () => {
  const [settings, setSettings]   = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving]       = useState(false);
  const [message, setMessage]     = useState(null);
  const [error, setError]         = useState(null);

  useEffect(() => {
    adminService.getSettings()
      .then(setSettings)
      .catch((err) => setError(err.message || 'Failed to load settings'))
      .finally(() => setIsLoading(false));
  }, []);

  const field = (key) => (e) => {
    setSettings({ ...settings, [key]: e.target.value });
    setMessage(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const updated = await adminService.updateSettings({
        min_order_amount:    Number(settings.min_order_amount   || 0),
        delivery_fee:        Number(settings.delivery_fee       || 0),
        convenience_fee:     Number(settings.convenience_fee    || 0),
        free_delivery_above: Number(settings.free_delivery_above || 0),
      });
      setSettings(updated);
      setMessage('Settings saved successfully.');
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <Loader label="Loading settings..." />;

  // Live fee preview
  const sampleOrderTotal   = 300;
  const freeAbove          = Number(settings?.free_delivery_above || 0);
  const deliveryFee        = sampleOrderTotal >= freeAbove && freeAbove > 0
    ? 0
    : Number(settings?.delivery_fee || 0);
  const convenienceFee     = Number(settings?.convenience_fee || 0);
  const sampleGrandTotal   = sampleOrderTotal + deliveryFee + convenienceFee;

  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Platform Settings</h1>
          {settings?.updated_at && (
            <p className="page-subtitle">Last updated: {fmtDateTime(settings.updated_at)}</p>
          )}
        </div>
      </div>

      {error   && <div className="alert alert--error">{error}</div>}
      {message && <div className="alert alert--success">{message}</div>}

      <div className="settings-layout">
        <div className="settings-card">
          <form className="settings-form" onSubmit={handleSubmit}>
            <div className="settings-section">
              <h2 className="settings-section__title">Fees &amp; Limits</h2>

              <div className="form-group">
                <label className="form-label">Minimum Order Amount (₹)</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings?.min_order_amount ?? ''}
                  onChange={field('min_order_amount')}
                  placeholder="0"
                />
                <p className="form-hint">Orders below this value cannot be placed.</p>
              </div>

              <div className="form-group">
                <label className="form-label">Delivery Fee (₹)</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings?.delivery_fee ?? ''}
                  onChange={field('delivery_fee')}
                  placeholder="0"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Convenience Fee (₹)</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings?.convenience_fee ?? ''}
                  onChange={field('convenience_fee')}
                  placeholder="0"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Free Delivery Above (₹)</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings?.free_delivery_above ?? ''}
                  onChange={field('free_delivery_above')}
                  placeholder="0"
                />
                <p className="form-hint">Orders at or above this amount get free delivery. Set 0 to disable.</p>
              </div>
            </div>

            <div className="settings-footer">
              <Button type="submit" isLoading={saving}>Save Changes</Button>
            </div>
          </form>
        </div>

        <div className="settings-preview">
          <h2 className="settings-section__title">Fee Preview</h2>
          <p className="settings-preview__note">Sample order total: <strong>{fmt(sampleOrderTotal)}</strong></p>
          <div className="settings-preview__rows">
            <div className="settings-preview__row">
              <span>Item Total</span>
              <span>{fmt(sampleOrderTotal)}</span>
            </div>
            <div className="settings-preview__row">
              <span>Delivery Fee</span>
              <span className={deliveryFee === 0 ? 'settings-preview__free' : ''}>
                {deliveryFee === 0 ? 'FREE' : fmt(deliveryFee)}
              </span>
            </div>
            <div className="settings-preview__row">
              <span>Convenience Fee</span>
              <span>{fmt(convenienceFee)}</span>
            </div>
            <div className="settings-preview__row settings-preview__row--total">
              <span>Grand Total</span>
              <span>{fmt(sampleGrandTotal)}</span>
            </div>
          </div>
          {freeAbove > 0 && (
            <p className="settings-preview__note">
              Free delivery on orders {fmt(freeAbove)} and above.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
