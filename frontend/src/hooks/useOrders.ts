import { useMemo } from 'react';
import { useOrdersStore } from '../store/ordersStore';

export function useOrders() {
  const orders = useOrdersStore((state) => state.orders);
  const addOrder = useOrdersStore((state) => state.addOrder);
  const updateStatus = useOrdersStore((state) => state.updateStatus);
  const updateTracking = useOrdersStore((state) => state.updateTracking);
  const cancelOrder = useOrdersStore((state) => state.cancelOrder);
  const requestReturn = useOrdersStore((state) => state.requestReturn);
  const getById = useOrdersStore((state) => state.getById);
  const resetSeed = useOrdersStore((state) => state.resetSeed);

  const recentOrders = useMemo(
    () => [...orders].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [orders]
  );

  return {
    orders,
    recentOrders,
    addOrder,
    updateStatus,
    updateTracking,
    cancelOrder,
    requestReturn,
    getById,
    resetSeed
  };
}
