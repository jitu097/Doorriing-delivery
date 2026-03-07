import { useEffect, useState } from 'react';
import { deliveryService } from '../../services/deliveryService';
import { DeliveryOrderCard } from '../../components/delivery/DeliveryOrderCard';
import { Loader } from '../../components/common/Loader';
import './AssignedOrders.css';

export const AssignedOrders = () => {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setIsLoading(true);
    deliveryService.getAssignedOrders()
      .then(setOrders)
      .catch((err) => setError(err.message || 'Failed to load orders'))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, []);

  const handleStatusChange = async (assignmentId, status) => {
    await deliveryService.updateAssignmentStatus(assignmentId, status);
    load();
  };

  return (
    <div className="assigned-page">
      <div className="page-header">
        <h1 className="page-title">Assigned Orders</h1>
        <span className="page-count">{orders.length} orders</span>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {isLoading ? (
        <Loader label="Loading assigned orders..." />
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
          <p>No orders assigned to you right now.</p>
        </div>
      ) : (
        <div className="assigned-list">
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
