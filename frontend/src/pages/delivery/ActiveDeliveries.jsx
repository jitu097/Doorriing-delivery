import { useEffect, useState } from 'react';
import { deliveryService } from '../../services/deliveryService';
import { DeliveryOrderCard } from '../../components/delivery/DeliveryOrderCard';
import { Loader } from '../../components/common/Loader';
import './ActiveDeliveries.css';

const ACTIVE_STATUSES = ['accepted', 'picked_up', 'out_for_delivery'];

export const ActiveDeliveries = () => {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = () => {
    setIsLoading(true);
    deliveryService.getAssignedOrders()
      .then((data) => setOrders((data || []).filter((o) => ACTIVE_STATUSES.includes(o.status))))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, []);

  const handleStatusChange = async (assignmentId, status) => {
    await deliveryService.updateAssignmentStatus(assignmentId, status);
    load();
  };

  return (
    <div className="active-page">
      <div className="page-header">
        <h1 className="page-title">Active Deliveries</h1>
        <span className="page-count">{orders.length} in progress</span>
      </div>

      {isLoading ? (
        <Loader label="Loading active deliveries..." />
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3"/><rect x="9" y="11" width="14" height="10" rx="2"/><circle cx="12" cy="16" r="1"/><circle cx="20" cy="16" r="1"/></svg>
          <p>No active deliveries at the moment.</p>
        </div>
      ) : (
        <div className="active-list">
          {orders.map((order) => (
            <DeliveryOrderCard
              key={order.id}
              order={order}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
};
