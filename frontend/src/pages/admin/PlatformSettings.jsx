import { useEffect, useState } from 'react';
import { adminService } from '../../services/adminService';
import { Button } from '../../components/common/Button';
import { Loader } from '../../components/common/Loader';
import './PlatformSettings.css';

export const PlatformSettings = () => {
  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

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
      await adminService.updateSettings(settings);
      setMessage('Settings saved successfully.');
    } catch (err) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <Loader label="Loading settings..." />;

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1 className="page-title">Platform Settings</h1>
      </div>

      {error && <div className="alert alert--error">{error}</div>}
      {message && <div className="alert alert--success">{message}</div>}

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
                value={settings?.min_order_amount ?? ''}
                onChange={field('min_order_amount')}
                placeholder="0"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Delivery Fee (₹)</label>
              <input
                className="form-input"
                type="number"
                min="0"
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
                value={settings?.free_delivery_above ?? ''}
                onChange={field('free_delivery_above')}
                placeholder="0"
              />
              <p className="form-hint">Orders above this amount get free delivery.</p>
            </div>
          </div>

          <div className="settings-footer">
            <Button type="submit" isLoading={saving}>Save Changes</Button>
          </div>
        </form>
      </div>
    </div>
  );
};
