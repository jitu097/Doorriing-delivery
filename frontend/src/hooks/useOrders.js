import { useEffect, useState } from 'react';
import { orderService } from '../services/orderService';

export const useOrders = () => {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetchOrders = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await orderService.list();
        if (!cancelled) setOrders(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load orders');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchOrders();
    return () => { cancelled = true; };
  }, []);

  return { orders, isLoading, error };
};
