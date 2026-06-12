import React from 'react';
import { OrderStatus } from '../../types/order';

interface StatusBadgeProps {
  status: OrderStatus;
}

const map: Record<OrderStatus, { label: string; classes: string; pulse?: boolean }> = {
  placed: {
    label: 'Placed',
    classes: 'bg-gray-100 text-gray-700',
  },
  processing: {
    label: 'Processing',
    classes: 'bg-amber-50 text-amber-700',
    pulse: true,
  },
  shipped: {
    label: 'Shipped',
    classes: 'bg-primary-50 text-primary',
  },
  delivered: {
    label: 'Delivered',
    classes: 'bg-success-light text-success',
  },
  cancelled: {
    label: 'Cancelled',
    classes: 'bg-red-50 text-red-600',
  },
  return_requested: {
    label: 'Return Requested',
    classes: 'bg-orange-50 text-orange-600',
    pulse: true,
  },
  returned: {
    label: 'Returned',
    classes: 'bg-teal-50 text-teal-700',
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  // Fallback so an unknown status never crashes the app
  const cfg = map[status] ?? { label: status, classes: 'bg-gray-100 text-gray-500' };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.classes}`}
    >
      {cfg.pulse && (
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulseDot" />
      )}
      {cfg.label}
    </span>
  );
}