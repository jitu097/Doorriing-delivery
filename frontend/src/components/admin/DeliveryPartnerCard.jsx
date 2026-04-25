import { useState, useCallback, memo } from 'react';
import { adminService } from '../../services/adminService';
import { Button } from '../common/Button';
import { ROUTES } from '../../config/constants';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../common/Modal';
import './DeliveryPartnerCard.css';

export const DeliveryPartnerCard = memo(({ partner: initialPartner }) => {
  const [partner, setPartner] = useState(initialPartner);
  const [busy, setBusy] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settling, setSettling] = useState(false);
  const [latestCash, setLatestCash] = useState(partner.wallet_cash || 0);
  const [fetchingLatest, setFetchingLatest] = useState(false);
  const navigate = useNavigate();

  const toggleStatus = useCallback(async () => {
    setBusy(true);
    try {
      await adminService.togglePartnerStatus(partner.id, !partner.is_active);
      setPartner({ ...partner, is_active: !partner.is_active });
    } finally {
      setBusy(false);
    }
  }, [partner]);

  const openSettleModal = async () => {
    setFetchingLatest(true);
    try {
      // Always fetch latest from backend before showing confirmation
      const cashData = await adminService.getPartnerCash(partner.id);
      const pendingSum = cashData
        .filter(e => e.status === 'pending')
        .reduce((sum, e) => sum + Number(e.amount), 0);
      
      setLatestCash(pendingSum);
      setShowSettleModal(true);
    } catch (err) {
      alert('Failed to fetch latest cash data. Please try again.');
    } finally {
      setFetchingLatest(false);
    }
  };

  const handleSettle = async () => {
    if (settling) return;
    setSettling(true);
    try {
      await adminService.settlePartnerCash(partner.id);
      setPartner({ ...partner, wallet_cash: 0 });
      setLatestCash(0);
      setShowSettleModal(false);
      // Optional: if parent component provided a refresh callback, call it here
    } catch (err) {
      alert(err.message || 'Failed to settle cash');
    } finally {
      setSettling(false);
    }
  };

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
        <div className="dp-card__stat dp-card__stat--cash">
          <span className="dp-card__stat-value">₹{Number(partner.wallet_cash || 0).toLocaleString()}</span>
          <span className="dp-card__stat-label">Cash in Hand</span>
          {Number(partner.wallet_cash) >= 5000 && (
            <span className="dp-card__high-cash-alert" title="High cash amount held by partner">⚠️ High</span>
          )}
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
        <div className="dp-card__cash-actions">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate(ROUTES.admin.partnerCash(partner.id))}
          >
            View Cash
          </Button>
          <Button 
            variant="success" 
            size="sm" 
            isLoading={fetchingLatest}
            disabled={Number(partner.wallet_cash || 0) <= 0 || fetchingLatest}
            onClick={openSettleModal}
          >
            Collect
          </Button>
        </div>
      </div>

      <Modal 
        isOpen={showSettleModal} 
        title="Confirm Cash Collection" 
        onClose={() => !settling && setShowSettleModal(false)}
      >
        <div className="settle-confirm">
          <p>Are you sure you have collected <strong>₹{Number(latestCash).toLocaleString()}</strong> from <strong>{partner.name}</strong>?</p>
          <p className="settle-confirm__note">This will reset their cash-in-hand to ₹0.</p>
          <div className="settle-confirm__actions">
            <Button variant="secondary" disabled={settling} onClick={() => setShowSettleModal(false)}>Cancel</Button>
            <Button variant="success" isLoading={settling} onClick={handleSettle}>Confirm & Settle</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
});
