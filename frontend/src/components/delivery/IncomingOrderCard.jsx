import React, { useState, useEffect, useCallback, useRef } from 'react';
import './IncomingOrderCard.css';

export const IncomingOrderCard = ({ order, onAccept, onDecline }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  
  const handleDecline = useCallback(async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setError(null);
    try {
      console.log("Declining assignment:", order.assignment_id);
      await onDecline(order.assignment_id);
    } catch (err) {
      console.error('Failed to decline order:', err);
      setError('Failed to decline');
    } finally {
      setIsProcessing(false);
    }
  }, [order.assignment_id, onDecline, isProcessing]);

  const handleAccept = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setError(null);
    try {
      console.log("Accepting assignment:", order.assignment_id);
      await onAccept(order.assignment_id);
    } catch (err) {
      console.error('Failed to accept order:', err);
      setError('Failed to accept');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="incoming-order-overlay">
      <div className="incoming-order-card">
        <div className="incoming-order-card__header">
          <div className="incoming-order-card__title">Incoming Order</div>
        </div>

        <div className="incoming-order-card__body">
          <div className="incoming-order-card__info">
            <span className="label">Order ID:</span>
            <span className="value">#{order.order_id}</span>
          </div>
          <div className="incoming-order-card__info">
            <span className="label">Shop:</span>
            <span className="value">{order.shop_name}</span>
          </div>
          <div className="incoming-order-card__info">
            <span className="label">Delivery To:</span>
            <span className="value address">{order.address}</span>
          </div>
          <div className="incoming-order-card__price">
            ₹{Number(order.total_price || 0).toFixed(2)}
          </div>
        </div>

        {error && <div className="incoming-order-card__error">{error}</div>}

        <div className="incoming-order-card__actions">
          <button 
            className="incoming-order-card__btn incoming-order-card__btn--decline"
            onClick={handleDecline}
            disabled={isProcessing}
          >
            {isProcessing ? '...' : 'Decline'}
          </button>
          <button 
            className="incoming-order-card__btn incoming-order-card__btn--accept"
            onClick={handleAccept}
            disabled={isProcessing}
          >
            {isProcessing ? 'Accepting...' : 'Accept Order'}
          </button>
        </div>
      </div>
    </div>
  );
};
