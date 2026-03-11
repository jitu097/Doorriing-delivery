import { formatDate } from '../../utils/formatDate';
import { formatCurrency } from '../../utils/formatCurrency';
import './DeliveryHistoryCard.css';

export const DeliveryHistoryCard = ({ record }) => {
  const shopName = record.orders?.shops?.name || record.shop_name || '';
  const orderId  = record.orders?.id || record.order_id || record.id;
  const amount   = record.orders?.total_amount ?? record.earning;

  return (
    <div className="dhistory-card">
      <div className="dhistory-card__left">
        <p className="dhistory-card__id">Order #{orderId?.slice(-8) ?? orderId}</p>
        {shopName && <p className="dhistory-card__shop">{shopName}</p>}
        <p className="dhistory-card__date">{record.delivered_at ? formatDate(record.delivered_at) : '—'}</p>
      </div>
      <div className="dhistory-card__right">
        {amount != null && (
          <p className="dhistory-card__earning">{formatCurrency(amount)}</p>
        )}
        <span className="badge badge--delivered">Delivered</span>
      </div>
    </div>
  );
};

