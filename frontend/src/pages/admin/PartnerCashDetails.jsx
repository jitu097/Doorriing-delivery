import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminService } from '../../services/adminService';
import { Button } from '../../components/common/Button';
import { Loader } from '../../components/common/Loader';
import { Modal } from '../../components/common/Modal';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/formatDate';
import './PartnerCashDetails.css';

export const PartnerCashDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [partner, setPartner] = useState(null);
  const [cashEntries, setCashEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [settling, setSettling] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // We need partner info to show name/wallet
      const partners = await adminService.getDeliveryPartners();
      const currentPartner = partners.find(p => p.id === id);
      
      if (!currentPartner) {
        throw new Error('Partner not found');
      }
      
      setPartner(currentPartner);
      
      const cashData = await adminService.getPartnerCash(id);
      setCashEntries(cashData);
    } catch (err) {
      setError(err.message || 'Failed to load cash details');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSettle = async () => {
    setSettling(true);
    try {
      await adminService.settlePartnerCash(id);
      // Refresh data
      await loadData();
      setShowSettleModal(false);
    } catch (err) {
      alert(err.message || 'Failed to settle cash');
    } finally {
      setSettling(false);
    }
  };

  if (isLoading) return <Loader label="Loading cash details..." />;
  if (error) return <div className="alert alert--error m-6">{error}</div>;
  if (!partner) return null;

  const pendingAmount = cashEntries
    .filter(e => e.status === 'pending')
    .reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="pcd">
      <button className="pcd__back" onClick={() => navigate('/admin/delivery-partners')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><polyline points="15 18 9 12 15 6"/></svg>
        Back to Partners
      </button>

      <div className="pcd__header card">
        <div className="pcd__header-info">
          <h1 className="pcd__header-name">{partner.name}'s Cash Ledger</h1>
          <p className="pcd__header-sub">{partner.email} · {partner.phone || 'No phone'}</p>
        </div>
        <div className="pcd__header-stats">
          <div className="pcd__stat-box">
            <span className="pcd__stat-label">Pending Collection</span>
            <span className="pcd__stat-value pcd__stat-value--pending">{formatCurrency(pendingAmount)}</span>
          </div>
          <Button 
            variant="success" 
            disabled={pendingAmount <= 0}
            onClick={() => setShowSettleModal(true)}
          >
            Collect All Cash
          </Button>
        </div>
      </div>

      <div className="card pcd__content">
        <h2 className="pcd__section-title">Collection History</h2>
        
        {cashEntries.length === 0 ? (
          <div className="empty-state">
            <p>No cash collection entries found.</p>
          </div>
        ) : (
          <div className="pcd__table-wrap">
            <table className="pcd__table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Settled At</th>
                </tr>
              </thead>
              <tbody>
                {cashEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="pcd__order-id">
                      #{String(entry.order_id).slice(-8).toUpperCase()}
                    </td>
                    <td className="pcd__amount">{formatCurrency(entry.amount)}</td>
                    <td>
                      <span className={`badge badge--${entry.status === 'settled' ? 'active' : 'warning'}`}>
                        {entry.status}
                      </span>
                    </td>
                    <td className="pcd__date">{formatDate(entry.created_at, 'DD MMM YY, hh:mm A')}</td>
                    <td className="pcd__date">
                      {entry.settled_at ? formatDate(entry.settled_at, 'DD MMM YY, hh:mm A') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal 
        isOpen={showSettleModal} 
        title="Confirm Cash Collection" 
        onClose={() => setShowSettleModal(false)}
      >
        <div className="settle-confirm">
          <p>Are you sure you have collected <strong>{formatCurrency(pendingAmount)}</strong> from <strong>{partner.name}</strong>?</p>
          <p className="settle-confirm__note">This will mark all pending entries as settled and reset the partner's wallet.</p>
          <div className="settle-confirm__actions">
            <Button variant="secondary" onClick={() => setShowSettleModal(false)}>Cancel</Button>
            <Button variant="success" isLoading={settling} onClick={handleSettle}>Confirm & Settle</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
