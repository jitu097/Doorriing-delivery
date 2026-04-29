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
  const [showPaymentModal, setShowPaymentModal] = useState(false);

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

  const orderItems   = orderData.order_items || [];
  const specialNotes = orderData.customer_notes || '';

  const paymentMethod = orderData.payment_method?.toUpperCase() || 'COD';
  const paymentStatus = orderData.payment_status || 'pending';
  const totalAmount   = Number(orderData.total_amount || 0);

  // Debugging logs as requested
  console.log("Assigned order response:", order);
  console.log("Order items:", orderItems);

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
      
      if (cfg.method === 'markDelivered') {
        console.log("Payment Method:", paymentMethod);
        console.log("Paid Amount:", paymentStatus === 'paid' ? totalAmount : 0);
        console.log("Pending COD:", paymentMethod === 'COD' && paymentStatus !== 'paid' ? totalAmount : 0);
        console.log("Opening COD popup");
        setShowPaymentModal(true);
      } else {
        onRefresh?.();
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }, [cfg, orderId, onRefresh, paymentMethod, paymentStatus, totalAmount]);

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    onRefresh?.();
  };

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

        {/* ── Items Section ── */}
        <div className="dorder-card__section">
          <p className="dorder-card__section-label dorder-card__section-label--items">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
            Items To Pickup
          </p>

          {orderItems.length === 0 ? (
            <p className="dorder-card__info-line dorder-card__info-line--muted">No item details available</p>
          ) : (
            <ul className="dorder-card__items-list">
              {orderItems.map((item, idx) => {
                const itemName = item.items?.name || 'Unknown Item';
                const variant = item.items?.unit || '';
                const qty = item.quantity || 1;
                return (
                  <li key={idx} className="dorder-card__item">
                    <span className="dorder-card__item-bullet">•</span> 
                    <span className="dorder-card__item-name">
                      {itemName} {variant && <span className="dorder-card__item-variant">({variant})</span>}
                    </span>
                    <span className="dorder-card__item-qty">— Qty: {qty}</span>
                  </li>
                );
              })}
            </ul>
          )}

          {specialNotes && (
            <div className="dorder-card__special-notes">
              <strong>Special Instructions:</strong>
              <p>{specialNotes}</p>
            </div>
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

          {/* Inline Payment Info */}
          <div className={`dorder-card__payment-inline ${paymentMethod === 'COD' && paymentStatus !== 'paid' ? 'dorder-card__payment-inline--cod' : 'dorder-card__payment-inline--online'}`}>
            <span className="dorder-card__payment-label">
              {paymentMethod === 'COD' && paymentStatus !== 'paid' ? 'To Collect:' : 'Payment:'}
            </span>
            <span className="dorder-card__payment-value">
              {paymentMethod === 'COD' && paymentStatus !== 'paid' ? `₹${totalAmount.toFixed(2)}` : 'Paid Online'}
            </span>
          </div>
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

      {/* ── Payment Modal ── */}
      {showPaymentModal && (
        <div className="payment-modal-overlay">
          <div className="payment-modal">
            <h3 className="payment-modal-title">Cash to Collect</h3>
            <p className="payment-modal-order">Order #{(orderId || order.id)?.slice(-8)}</p>
            
            {paymentMethod === 'COD' && paymentStatus !== 'paid' ? (
              <>
                <p className="payment-modal-instruction">Collect from customer:</p>
                <div className="payment-modal-amount">₹{totalAmount.toFixed(2)}</div>
                <p className="payment-modal-method">Payment Method: Cash on Delivery</p>
                <div className="payment-modal-alert">
                  <strong>Please collect full amount at delivery.</strong>
                </div>
              </>
            ) : (
              <>
                <div className="payment-modal-method">Payment Status: Paid Online</div>
                <div className="payment-modal-alert payment-modal-alert--success">
                  <strong>No cash collection required</strong>
                </div>
              </>
            )}

            <div className="payment-modal-actions">
              <Button variant="primary" onClick={closePaymentModal}>Confirm</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});


