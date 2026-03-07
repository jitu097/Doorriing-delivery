import { useEffect, useState } from 'react';
import { orderService } from '../services/orderService';

export const useOrders = () => {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchOrders = async () => {
      setIsLoading(true);
      const data = await orderService.list();
      setOrders(Array.isArray(data) ? data : []);
      setIsLoading(false);
    };

    fetchOrders();
  }, []);

  return { orders, isLoading };
};
