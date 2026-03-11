import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../services/adminService';
import { Button } from '../common/Button';
import { ROUTES } from '../../config/constants';
import './ShopCard.css';

export const ShopCard = ({ shop: initialShop, onUpdate }) => {
  const [shop, setShop] = useState(initialShop);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const toggleBlock = async (e) => {
    e.stopPropagation();
    setBusy(true);
    try {
      await adminService.setShopBlock(shop.id, !shop.is_blocked);
      const updated = { ...shop, is_blocked: !shop.is_blocked };
      setShop(updated);
      onUpdate?.(updated);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`shop-card ${shop.is_blocked ? 'shop-card--blocked' : ''}`}
      onClick={() => navigate(ROUTES.admin.shopDetails(shop.id))}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(ROUTES.admin.shopDetails(shop.id))}
    >
      <div className="shop-card__header">
        <div className="shop-card__avatar">
          {(shop.shop_name || 'S').charAt(0).toUpperCase()}
        </div>
        <div className="shop-card__info">
          <h3 className="shop-card__name">{shop.shop_name}</h3>
          <p className="shop-card__city">{shop.city || '—'}</p>
        </div>
        <span className={`badge badge--${shop.is_blocked ? 'blocked' : 'active'}`}>
          {shop.is_blocked ? 'Blocked' : 'Active'}
        </span>
      </div>

      <div className="shop-card__meta">
        {shop.phone && <span>{shop.phone}</span>}
        {shop.email && <span>{shop.email}</span>}
      </div>

      <div className="shop-card__footer">
        <Button
          variant={shop.is_blocked ? 'success' : 'danger'}
          size="sm"
          isLoading={busy}
          onClick={toggleBlock}
        >
          {shop.is_blocked ? 'Unblock Shop' : 'Block Shop'}
        </Button>
      </div>
    </div>
  );
};
