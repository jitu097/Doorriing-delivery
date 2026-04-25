import { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import { deliveryService } from '../services/deliveryService';
import { adminService } from '../services/adminService';
import { useAuth } from '../hooks/useAuth';

export const OrderContext = createContext(null);

export const OrderProvider = ({ children }) => {
  const { courier, adminUser } = useAuth();
  const [activeOrders, setActiveOrders] = useState([]);
  const [history, setHistory] = useState([]);
  const [orders, setOrders] = useState([]); // All orders for admin
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchActiveOrders = useCallback(async () => {
    if (!courier) return;
    setIsLoading(true);
    try {
      const data = await deliveryService.getAssignedOrders();
      // Filter out 'assigned' (those are handled by NotificationProvider/IncomingOrderCard)
      // We want 'accepted', 'picked_up', 'out_for_delivery'
      const active = data.filter(o => ['accepted', 'picked_up', 'out_for_delivery'].includes(o.status));
      setActiveOrders(active);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [courier]);

  const fetchHistory = useCallback(async () => {
    if (!courier) return;
    setIsLoading(true);
    try {
      const data = await deliveryService.getHistory();
      setHistory(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [courier]);

  const fetchAllOrders = useCallback(async () => {
    if (!adminUser) return;
    setIsLoading(true);
    try {
      const data = await adminService.getOrders();
      setOrders(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [adminUser]);

  useEffect(() => {
    if (courier) {
      fetchActiveOrders();
      fetchHistory();
    } else if (adminUser) {
      fetchAllOrders();
    } else {
      setActiveOrders([]);
      setHistory([]);
      setOrders([]);
    }
  }, [courier, adminUser, fetchActiveOrders, fetchHistory, fetchAllOrders]);

  const updateStatus = useCallback(async (orderId, status) => {
    try {
      if (status === 'picked_up') await deliveryService.pickedUp(orderId);
      else if (status === 'out_for_delivery') await deliveryService.outForDelivery(orderId);
      else if (status === 'delivered') await deliveryService.markDelivered(orderId);
      
      await fetchActiveOrders();
      if (status === 'delivered') {
        await fetchHistory();
      }
    } catch (err) {
      console.error('[OrderProvider] Status update error:', err);
      throw err;
    }
  }, [fetchActiveOrders, fetchHistory]);

  const value = useMemo(() => ({
    orders,
    activeOrders,
    history,
    isLoading,
    error,
    refreshOrders: fetchActiveOrders,
    refreshHistory: fetchHistory,
    refreshAllOrders: fetchAllOrders,
    updateStatus
  }), [orders, activeOrders, history, isLoading, error, fetchActiveOrders, fetchHistory, fetchAllOrders, updateStatus]);

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
};
