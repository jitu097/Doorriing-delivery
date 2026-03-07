import { useEffect, useState } from 'react';
import { deliveryService } from '../../services/deliveryService';
import { DeliveryHistoryCard } from '../../components/delivery/DeliveryHistoryCard';
import { Loader } from '../../components/common/Loader';
import { formatCurrency } from '../../utils/formatCurrency';
import './DeliveryHistory.css';

export const DeliveryHistory = () => {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    deliveryService.getHistory()
      .then(setHistory)
      .catch((err) => setError(err.message || 'Failed to load history'))
      .finally(() => setIsLoading(false));
  }, []);

  const totalEarnings = history.reduce((sum, r) => sum + (r.earning ?? 0), 0);

  return (
    <div className="history-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Delivery History</h1>
          <span className="page-count">{history.length} completed</span>
        </div>
        {history.length > 0 && (
          <div className="history-total">
            <p className="history-total__label">Total Earnings</p>
            <p className="history-total__value">{formatCurrency(totalEarnings)}</p>
          </div>
        )}
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {isLoading ? (
        <Loader label="Loading history..." />
      ) : history.length === 0 ? (
        <div className="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <p>No delivery history yet.</p>
        </div>
      ) : (
        <div className="history-list">
          {history.map((record) => (
            <DeliveryHistoryCard key={record.id} record={record} />
          ))}
        </div>
      )}
    </div>
  );
};
