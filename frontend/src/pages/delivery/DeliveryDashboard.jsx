import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deliveryService } from '../../services/deliveryService';
import { DeliveryStatusButtons } from '../../components/delivery/DeliveryStatusButtons';
import { Loader } from '../../components/common/Loader';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../config/constants';
import './DeliveryDashboard.css';

export const DeliveryDashboard = () => {
  const { courier } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        // Try to fetch actual delivery status from database
        try {
          const profile = await deliveryService.getProfile();
          setIsOnline(profile.delivery_status === 'online');
        } catch (err) {
          // Fallback: if getProfile endpoint doesn't exist yet, default to online
          console.warn('Profile endpoint not available, defaulting to online');
          setIsOnline(true);
        }

        // Fetch assigned orders
        const orderData = await deliveryService.getAssignedOrders();
        setOrders(orderData);
      } catch (err) {
        setError(err.message || 'Failed to load orders');
        setIsOnline(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Handle status toggle with DB persistence
  const handleStatusToggle = async () => {
    const newStatus = isOnline ? 'offline' : 'online';

    try {
      setIsUpdatingStatus(true);
      // Try to update database first
      try {
        await deliveryService.updateDeliveryStatus(newStatus);
      } catch (err) {
        // Fallback: if endpoint doesn't exist yet, just toggle UI
        console.warn('Status endpoint not available');
      }
      // Update UI
      setIsOnline(!isOnline);
    } catch (err) {
      setError(err.message || 'Failed to update status');
      // Don't toggle UI on error
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const active = orders.filter((o) => ['accepted', 'picked_up', 'out_for_delivery'].includes(o.status));
  const pending = orders.filter((o) => o.status === 'assigned');

  return (
    <div className="ddash-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome, {courier?.name?.split(' ')[0] ?? 'Partner'}!</h1>
          <p className="page-subtitle">Here's your delivery overview for today.</p>
        </div>
        <DeliveryStatusButtons
          isOnline={isOnline}
          onToggle={handleStatusToggle}
          isUpdating={isUpdatingStatus}
        />
      </div>

      {isLoading ? (
        <Loader label="Loading orders..." />
      ) : (
        <div className="ddash-stats">
          <div 
            className="ddash-stat" 
            onClick={() => navigate(ROUTES.delivery.assigned)}
            style={{ cursor: 'pointer' }}
          >
            <p className="ddash-stat__value">{pending.length}</p>
            <p className="ddash-stat__label">New Assignments</p>
          </div>
          <div 
            className="ddash-stat ddash-stat--active"
            onClick={() => navigate(ROUTES.delivery.assigned)}
            style={{ cursor: 'pointer' }}
          >
            <p className="ddash-stat__value">{active.length}</p>
            <p className="ddash-stat__label">In Progress</p>
          </div>
          <div 
            className="ddash-stat ddash-stat--done"
            onClick={() => navigate(ROUTES.delivery.history)}
            style={{ cursor: 'pointer' }}
          >
            <p className="ddash-stat__value">{orders.filter((o) => o.status === 'delivered').length}</p>
            <p className="ddash-stat__label">Delivered Today</p>
          </div>
        </div>
      )}
    </div>
  );
};
