import { useState, useCallback, memo } from 'react';
import { adminService } from '../../services/adminService';
import { Button } from '../common/Button';
import './DeliveryPartnerCard.css';

export const DeliveryPartnerCard = memo(({ partner: initialPartner }) => {
  const [partner, setPartner] = useState(initialPartner);
  const [busy, setBusy] = useState(false);

  const toggleStatus = useCallback(async () => {
    setBusy(true);
    try {
      await adminService.togglePartnerStatus(partner.id, !partner.is_active);
      setPartner({ ...partner, is_active: !partner.is_active });
    } finally {
      setBusy(false);
    }
  }, [partner]);

  const initial = (partner.name || 'D').charAt(0).toUpperCase();

  return (
    <div className={`dp-card ${!partner.is_active ? 'dp-card--inactive' : ''}`}>
      <div className="dp-card__avatar">{initial}</div>
      <div className="dp-card__info">
        <h4 className="dp-card__name">{partner.name}</h4>
        <p className="dp-card__meta">{partner.email}</p>
        {partner.phone && <p className="dp-card__meta">{partner.phone}</p>}
        {partner.vehicle_type && (
          <p className="dp-card__meta dp-card__vehicle">
            {partner.vehicle_type.charAt(0).toUpperCase() + partner.vehicle_type.slice(1)}
          </p>
        )}
      </div>
      <div className="dp-card__stats">
        <div className="dp-card__stat">
          <span className="dp-card__stat-value">{partner.active_deliveries ?? 0}</span>
          <span className="dp-card__stat-label">Active</span>
        </div>
        <div className="dp-card__stat">
          <span className="dp-card__stat-value">{partner.total_deliveries ?? 0}</span>
          <span className="dp-card__stat-label">Total</span>
        </div>
      </div>
      <div className="dp-card__actions">
        <span className={`badge badge--${partner.is_active ? 'active' : 'inactive'}`}>
          {partner.is_active ? 'Active' : 'Inactive'}
        </span>
        <Button
          variant={partner.is_active ? 'secondary' : 'success'}
          size="sm"
          isLoading={busy}
          onClick={toggleStatus}
        >
          {partner.is_active ? 'Deactivate' : 'Activate'}
        </Button>
      </div>
    </div>
  );
});
