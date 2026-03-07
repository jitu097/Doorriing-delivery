import { formatDate } from '../../utils/formatDate';
import { formatCurrency } from '../../utils/formatCurrency';
import './DeliveryHistoryCard.css';

export const DeliveryHistoryCard = ({ record }) => (
  <div className="dhistory-card">
    <div className="dhistory-card__left">
      <p className="dhistory-card__id">Order #{record.id?.slice(-8) ?? record.id}</p>
      <p className="dhistory-card__shop">{record.shop_name || record.shop?.name || ''}</p>
      <p className="dhistory-card__date">{record.delivered_at ? formatDate(record.delivered_at) : '—'}</p>
    </div>
    <div className="dhistory-card__right">
      {record.earning != null && (
        <p className="dhistory-card__earning">{formatCurrency(record.earning)}</p>
      )}
      <span className="badge badge--delivered">Delivered</span>
    </div>
  </div>
);
