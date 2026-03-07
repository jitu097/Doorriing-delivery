import { useState } from 'react';
import { formatDate } from '../../utils/formatDate';
import { Button } from '../common/Button';
import './DeliveryOrderCard.css';

const STATUS_NEXT = {
  assigned:         { label: 'Accept Order',     next: 'accepted',        variant: 'primary' },
  accepted:         { label: 'Mark Picked Up',   next: 'picked_up',       variant: 'primary' },
  picked_up:        { label: 'Out for Delivery', next: 'out_for_delivery', variant: 'primary' },
  out_for_delivery: { label: 'Mark Delivered',   next: 'delivered',       variant: 'success' },
};

export const DeliveryOrderCard = ({ order, onStatusChange }) => {
  const [busy, setBusy] = useState(false);
  const action = STATUS_NEXT[order.status];

  const handleAction = async () => {
    if (!action) return;
    setBusy(true);
    try {
      await onStatusChange(order.id, action.next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dorder-card">
      <div className="dorder-card__top">
        <div>
          <p className="dorder-card__id">Order #{order.id?.slice(-8) ?? order.id}</p>
          <p className="dorder-card__shop">{order.shop_name || order.shop?.name || 'Shop'}</p>
        </div>
        <span className={`badge badge--${order.status}`}>
          {order.status?.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="dorder-card__details">
        <div className="dorder-card__detail">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <span>{order.delivery_address || order.address || 'Address not provided'}</span>
        </div>
        {order.created_at && (
          <div className="dorder-card__detail">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>{formatDate(order.created_at)}</span>
          </div>
        )}
      </div>

      {action && (
        <div className="dorder-card__footer">
          <Button
            variant={action.variant}
            size="sm"
            isLoading={busy}
            onClick={handleAction}
          >
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
};
