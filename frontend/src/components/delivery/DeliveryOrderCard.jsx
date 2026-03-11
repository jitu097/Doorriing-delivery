import { useState, useCallback, memo } from 'react';
import { deliveryService } from '../../services/deliveryService';
import { Button } from '../common/Button';
import './DeliveryOrderCard.css';

// Maps current assignment status → next action (no Accept step: assigned goes straight to picked_up)
const STATUS_CONFIG = {
  assigned:         { label: 'Mark Picked Up',   method: 'pickedUp',      variant: 'blue' },
  accepted:         { label: 'Mark Picked Up',   method: 'pickedUp',      variant: 'blue' },
  picked_up:        { label: 'Out for Delivery', method: 'outForDelivery', variant: 'primary' },
  out_for_delivery: { label: 'Mark Delivered',   method: 'markDelivered', variant: 'success' },
};

const formatAddress = (addr) => {
  if (!addr) return null;
  return [
    addr.address_line_1 || addr.address_line1,
    addr.address_line_2 || addr.address_line2,
    addr.city,
    addr.state,
    addr.pincode,
    addr.landmark,
  ]
    .filter(Boolean)
    .join(', ');
};

const openInMaps = (query) => {
  window.open(
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
    '_blank',
    'noopener,noreferrer'
  );
};

export const DeliveryOrderCard = memo(({ order, onRefresh }) => {
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState(null);

  const cfg          = STATUS_CONFIG[order.status];
  const orderData    = order.orders || {};
  const shop         = orderData.shops || {};
  const customer     = orderData.customers || {};
  // customer_addresses is an array on the customers join — pick default or first
  const addrList     = customer.customer_addresses || [];
  const addr         = addrList.find((a) => a.is_default) || addrList[0] || null;
  const customerAddr = formatAddress(addr);
  // phone: prefer customer record, fall back to address phone
  const customerPhone = customer.phone || addr?.phone || null;

  // Prefer orders.id (the actual order id) for the API call
  const orderId = orderData.id || order.order_id;

  // Navigate-to-shop is useful while heading to pickup
  const atShop     = ['assigned', 'accepted'].includes(order.status);
  // Navigate-to-customer is useful after pickup
  const atCustomer = ['picked_up', 'out_for_delivery'].includes(order.status);

  const handleAction = useCallback(async () => {
    if (!cfg) return;
    setBusy(true);
    setError(null);
    try {
      await deliveryService[cfg.method](orderId);
      onRefresh?.();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }, [cfg, orderId, onRefresh]);

  return (
    <div className="dorder-card">
      {/* ── Header ── */}
      <div className="dorder-card__header">
        <span className="dorder-card__id">Order #{(orderId || order.id)?.slice(-8)}</span>
        <span className={`badge badge--${order.status}`}>
          {order.status?.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="dorder-card__body">
        {/* ── Pickup Section ── */}
        <div className="dorder-card__section">
          <p className="dorder-card__section-label dorder-card__section-label--pickup">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            Pickup
          </p>

          <p className="dorder-card__info-name">{shop.name || '—'}</p>

          {shop.address && (
            <p className="dorder-card__info-line">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              {shop.address}
            </p>
          )}

          {shop.phone && (
            <p className="dorder-card__info-line">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.88 19.79 19.79 0 01.18 1.2 2 2 0 012.18 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.29 6.29l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
              </svg>
              <a href={`tel:${shop.phone}`} className="dorder-card__phone">{shop.phone}</a>
            </p>
          )}

          {atShop && shop.address && (
            <button
              type="button"
              className="dorder-card__nav-btn dorder-card__nav-btn--orange"
              onClick={() => openInMaps(shop.address)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="3 11 22 2 13 21 11 13 3 11"/>
              </svg>
              Navigate to Shop
            </button>
          )}
        </div>

        {/* ── Delivery Section ── */}
        <div className="dorder-card__section">
          <p className="dorder-card__section-label dorder-card__section-label--delivery">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
            Delivery
          </p>

          <p className="dorder-card__info-name">{customer.full_name || '—'}</p>

          {customerPhone && (
            <p className="dorder-card__info-line">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.88 19.79 19.79 0 01.18 1.2 2 2 0 012.18 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.29 6.29l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
              </svg>
              <a href={`tel:${customerPhone}`} className="dorder-card__phone">{customerPhone}</a>
            </p>
          )}

          {customerAddr ? (
            <p className="dorder-card__info-line">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              {customerAddr}
            </p>
          ) : (
            <p className="dorder-card__info-line dorder-card__info-line--muted">Address not available</p>
          )}

          {atCustomer && customerAddr && (
            <button
              type="button"
              className="dorder-card__nav-btn dorder-card__nav-btn--blue"
              onClick={() => openInMaps(customerAddr)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="3 11 22 2 13 21 11 13 3 11"/>
              </svg>
              Navigate to Customer
            </button>
          )}
        </div>
      </div>

      {/* ── Error ── */}
      {error && <p className="dorder-card__err">{error}</p>}

      {/* ── Action Footer ── */}
      {cfg && (
        <div className="dorder-card__footer">
          <Button variant={cfg.variant} size="sm" isLoading={busy} onClick={handleAction}>
            {cfg.label}
          </Button>
        </div>
      )}
    </div>
  );
});


