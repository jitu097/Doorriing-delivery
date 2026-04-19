import { useEffect, useState } from 'react';
import { deliveryService } from '../../services/deliveryService';
import { DeliveryStatusButtons } from '../../components/delivery/DeliveryStatusButtons';
import { Loader } from '../../components/common/Loader';
import { useAuth } from '../../hooks/useAuth';
import './DeliveryDashboard.css';

export const DeliveryDashboard = () => {
  const { courier } = useAuth();
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    deliveryService.getAssignedOrders()
      .then(setOrders)
      .catch((err) => setError(err.message || 'Failed to load orders'))
      .finally(() => setIsLoading(false));
  }, []);

  const active  = orders.filter((o) => ['accepted', 'picked_up', 'out_for_delivery'].includes(o.status));
  const pending = orders.filter((o) => o.status === 'assigned');

  return (
    <div className="ddash-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome, {courier?.name?.split(' ')[0] ?? 'Partner'}!</h1>
          <p className="page-subtitle">Here’s your delivery overview for today.</p>
        </div>
        <DeliveryStatusButtons isOnline={isOnline} onToggle={() => setIsOnline((v) => !v)} />
      </div>

      {isLoading ? (
        <Loader label="Loading orders..." />
      ) : (
        <div className="ddash-stats">
          <div className="ddash-stat">
            <p className="ddash-stat__value">{pending.length}</p>
            <p className="ddash-stat__label">New Assignments</p>
          </div>
          <div className="ddash-stat ddash-stat--active">
            <p className="ddash-stat__value">{active.length}</p>
            <p className="ddash-stat__label">In Progress</p>
          </div>
          <div className="ddash-stat ddash-stat--done">
            <p className="ddash-stat__value">{orders.filter((o) => o.status === 'delivered').length}</p>
            <p className="ddash-stat__label">Delivered Today</p>
          </div>
        </div>
      )}
    </div>
  );
};
