import { useEffect, useState } from 'react';
import { adminService } from '../../services/adminService';
import { DeliveryPartnerCard } from '../../components/admin/DeliveryPartnerCard';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Loader } from '../../components/common/Loader';
import './DeliveryPartners.css';

const EMPTY_FORM = { name: '', email: '', phone: '', password: '' };

export const DeliveryPartners = () => {
  const [partners, setPartners] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const load = () => {
    setIsLoading(true);
    adminService.getDeliveryPartners()
      .then(setPartners)
      .catch((err) => setError(err.message || 'Failed to load partners'))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await adminService.createDeliveryPartner(form);
      setShowModal(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setFormError(err.message || 'Failed to create partner');
    } finally {
      setSaving(false);
    }
  };

  const field = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <div className="dp-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Delivery Partners</h1>
          <span className="page-count">{partners.length} partners</span>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Partner
        </Button>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {isLoading ? (
        <Loader label="Loading partners..." />
      ) : partners.length === 0 ? (
        <div className="empty-state"><p>No delivery partners yet.</p></div>
      ) : (
        <div className="dp-list">
          {partners.map((partner) => (
            <DeliveryPartnerCard key={partner.id} partner={partner} />
          ))}
        </div>
      )}

      <Modal isOpen={showModal} title="Add Delivery Partner" onClose={() => setShowModal(false)}>
        <form className="partner-form" onSubmit={handleCreate}>
          {formError && <div className="alert alert--error">{formError}</div>}
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" required value={form.name} onChange={field('name')} placeholder="John Doe" />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" required value={form.email} onChange={field('email')} placeholder="partner@example.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input className="form-input" type="tel" value={form.phone} onChange={field('phone')} placeholder="+91 99999 99999" />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" required value={form.password} onChange={field('password')} placeholder="Temporary password" />
          </div>
          <div className="partner-form__footer">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" isLoading={saving}>Create Partner</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
