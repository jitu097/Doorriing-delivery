import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminService } from '../../services/adminService';
import { Button } from '../../components/common/Button';
import { Loader } from '../../components/common/Loader';
import { Modal } from '../../components/common/Modal';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/formatDate';
import './AdminShopDetails.css';

const STAT_CARDS = [
  { key: 'total_orders',     label: 'Total Orders',     color: 'blue',   icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>  },
  { key: 'active_orders',    label: 'Active Orders',    color: 'orange', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> },
  { key: 'delivered_orders', label: 'Delivered',        color: 'green',  icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="20 6 9 17 4 12"/></svg> },
  { key: 'cancelled_orders', label: 'Cancelled',        color: 'red',    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> },
  { key: 'total_revenue',    label: 'Total Revenue',    color: 'purple', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>, isCurrency: true },
];

const INFO_ROWS = [
  { label: 'Shop Name',      key: 'shop_name' },
  { label: 'Owner',          key: 'owner_name' },
  { label: 'Phone',          key: 'phone' },
  { label: 'City',           key: 'city' },
  { label: 'Business Type',  key: 'business_type' },
  { label: 'Joined',         key: 'created_at', render: (v) => formatDate(v, 'DD MMM YYYY') },
];

export const AdminShopDetails = () => {
  const { shopId } = useParams();
  const navigate = useNavigate();

  const [shop, setShop]         = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [orders, setOrders]     = useState([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [page, setPage]         = useState(1);
  const [isLoading, setIsLoading]         = useState(true);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const [error, setError]       = useState(null);
  const [blockBusy, setBlockBusy] = useState(false);

  // ── Withdrawal state ──────────────────────────────────────
  const [withdrawals, setWithdrawals]         = useState([]);
  const [wdLoading, setWdLoading]             = useState(true);
  const [wdActionBusy, setWdActionBusy]       = useState(null); // withdrawId being actioned
  const [detailModal, setDetailModal]         = useState(null); // withdrawal row to preview
  const [rejectModal, setRejectModal]         = useState(null); // withdrawal row to reject
  const [rejectNote, setRejectNote]           = useState('');
  const [wdError, setWdError]                 = useState(null);

  const loadWithdrawals = useCallback(async () => {
    setWdLoading(true);
    setWdError(null);
    try {
      const data = await adminService.getShopWithdrawals(shopId);
      setWithdrawals(data);
    } catch (err) {
      setWdError(err.message || 'Failed to load withdrawal requests');
    } finally {
      setWdLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    Promise.all([
      adminService.getShopById(shopId),
      adminService.getShopAnalytics(shopId),
      adminService.getShopOrders(shopId, { page: 1, limit: 20 }),
    ])
      .then(([shopData, analyticsData, ordersData]) => {
        setShop(shopData);
        setAnalytics(analyticsData);
        setOrders(ordersData.orders);
        setOrdersTotal(ordersData.total);
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));

    loadWithdrawals();
  }, [shopId, loadWithdrawals]);

  const loadMore = async () => {
    const next = page + 1;
    setIsOrdersLoading(true);
    try {
      const data = await adminService.getShopOrders(shopId, { page: next, limit: 20 });
      setOrders((prev) => [...prev, ...data.orders]);
      setPage(next);
    } catch (err) {
      // swallow — not critical
    } finally {
      setIsOrdersLoading(false);
    }
  };

  const toggleBlock = async () => {
    setBlockBusy(true);
    try {
      await adminService.setShopBlock(shopId, !shop.is_blocked);
      setShop((s) => ({ ...s, is_blocked: !s.is_blocked }));
    } finally {
      setBlockBusy(false);
    }
  };

  const handleApprove = async (wd) => {
    if (!window.confirm(`Approve withdrawal of ${formatCurrency(wd.amount)} for this shop?\n\nMake sure you have already transferred the amount manually.`)) return;
    setWdActionBusy(wd.id);
    setWdError(null);
    try {
      const updated = await adminService.approveWithdrawal(wd.id);
      setWithdrawals((prev) => prev.map((w) => w.id === wd.id ? updated : w));
    } catch (err) {
      setWdError(err.message || 'Approval failed');
    } finally {
      setWdActionBusy(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setWdActionBusy(rejectModal.id);
    setWdError(null);
    try {
      const updated = await adminService.rejectWithdrawal(rejectModal.id, rejectNote);
      setWithdrawals((prev) => prev.map((w) => w.id === rejectModal.id ? updated : w));
      setRejectModal(null);
      setRejectNote('');
    } catch (err) {
      setWdError(err.message || 'Rejection failed');
    } finally {
      setWdActionBusy(null);
    }
  };

  if (isLoading) return <Loader label="Loading shop details…" />;
  if (error)     return <div className="alert alert--error" style={{ margin: 24 }}>{error}</div>;
  if (!shop)     return null;

  const statusLabel = shop.is_blocked ? 'Blocked' : (shop.is_active ? 'Active' : 'Inactive');
  const statusBadge = shop.is_blocked ? 'blocked' : (shop.is_active ? 'active' : 'inactive');

  return (
    <div className="sd">
      {/* ── Back ── */}
      <button className="sd__back" onClick={() => navigate('/admin/shops')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><polyline points="15 18 9 12 15 6"/></svg>
        Back to Shops
      </button>

      {/* ── Header ── */}
      <div className="sd__header card">
        <div className="sd__header-avatar">{(shop.shop_name || 'S').charAt(0).toUpperCase()}</div>
        <div className="sd__header-info">
          <h1 className="sd__header-name">{shop.shop_name}</h1>
          <p className="sd__header-sub">
            {[shop.city, shop.business_type].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="sd__header-actions">
          <span className={`badge badge--${statusBadge}`}>{statusLabel}</span>
          <Button
            variant={shop.is_blocked ? 'success' : 'danger'}
            size="sm"
            isLoading={blockBusy}
            onClick={toggleBlock}
          >
            {shop.is_blocked ? 'Unblock Shop' : 'Block Shop'}
          </Button>
        </div>
      </div>

      {/* ── Shop Info ── */}
      <div className="card sd__info-card">
        <h2 className="sd__section-title">Shop Information</h2>
        <div className="sd__info-grid">
          {INFO_ROWS.map(({ label, key, render }) => (
            <div key={key} className="sd__info-item">
              <span className="sd__info-label">{label}</span>
              <span className="sd__info-value">
                {render ? render(shop[key]) : (shop[key] || '—')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Analytics ── */}
      {analytics && (
        <div className="sd__analytics">
          {STAT_CARDS.map(({ key, label, color, icon, isCurrency }) => (
            <div key={key} className={`sd__stat-card sd__stat-card--${color}`}>
              <div className="sd__stat-icon">{icon}</div>
              <div className="sd__stat-body">
                <p className="sd__stat-value">
                  {isCurrency ? formatCurrency(analytics[key]) : analytics[key].toLocaleString()}
                </p>
                <p className="sd__stat-label">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Orders Table ── */}
      <div className="card sd__orders-card">
        <div className="sd__orders-header">
          <h2 className="sd__section-title">Orders</h2>
          <span className="sd__orders-count">{ordersTotal.toLocaleString()} total</span>
        </div>

        {orders.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state__icon">🛒</span>
            <p className="empty-state__text">No orders yet</p>
          </div>
        ) : (
          <>
            <div className="sd__table-wrap">
              <table className="sd__table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td className="sd__order-id">#{String(o.id).slice(-8).toUpperCase()}</td>
                      <td>{formatCurrency(o.total_amount)}</td>
                      <td>
                        <span className={`badge badge--${o.status}`}>{o.status.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="sd__date">{formatDate(o.created_at, 'DD MMM YY, hh:mm A')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {orders.length < ordersTotal && (
              <div className="sd__load-more">
                <Button variant="secondary" size="sm" isLoading={isOrdersLoading} onClick={loadMore}>
                  Load More Orders
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Withdrawal Requests ── */}
      <div className="card sd__wd-card">
        <div className="sd__orders-header">
          <h2 className="sd__section-title">Withdrawal Requests</h2>
          <span className="sd__orders-count">
            {withdrawals.filter((w) => w.status === 'pending').length} pending
          </span>
        </div>

        {wdError && (
          <div className="sd__wd-error">{wdError}</div>
        )}

        {wdLoading ? (
          <Loader label="Loading withdrawals…" />
        ) : withdrawals.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state__icon">💳</span>
            <p className="empty-state__text">No withdrawal requests yet</p>
          </div>
        ) : (
          <div className="sd__table-wrap">
            <table className="sd__table">
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Account / UPI</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((wd) => (
                  <tr key={wd.id}>
                    <td className="sd__order-id">#{String(wd.id).slice(-8).toUpperCase()}</td>
                    <td className="sd__wd-amount">{formatCurrency(wd.amount)}</td>
                    <td>
                      <span className={`sd__wd-method sd__wd-method--${wd.payout_account?.type || wd.method || 'bank'}`}>
                        {(wd.payout_account?.type || wd.method) === 'upi' ? 'UPI' : 'Bank'}
                      </span>
                    </td>
                    <td className="sd__wd-account">
                      {(wd.payout_account?.type || wd.method) === 'upi'
                        ? (wd.payout_account?.upi_id || wd.upi_id || '—')
                        : (wd.payout_account?.account_number
                            ? `****${String(wd.payout_account.account_number).slice(-4)}`
                            : '—')}
                    </td>
                    <td>
                      <span className={`badge badge--wd-${wd.status}`}>
                        {wd.status.charAt(0).toUpperCase() + wd.status.slice(1)}
                      </span>
                    </td>
                    <td className="sd__date">{formatDate(wd.created_at, 'DD MMM YY, hh:mm A')}</td>
                    <td>
                      <div className="sd__wd-actions">
                        <button
                          className="sd__wd-btn sd__wd-btn--view"
                          onClick={() => setDetailModal(wd)}
                          title="View details"
                        >
                          View
                        </button>
                        {wd.status === 'pending' && (
                          <>
                            <button
                              className="sd__wd-btn sd__wd-btn--approve"
                              disabled={wdActionBusy === wd.id}
                              onClick={() => handleApprove(wd)}
                            >
                              {wdActionBusy === wd.id ? '…' : 'Approve'}
                            </button>
                            <button
                              className="sd__wd-btn sd__wd-btn--reject"
                              disabled={wdActionBusy === wd.id}
                              onClick={() => { setRejectModal(wd); setRejectNote(''); }}
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Detail Modal ── */}
      <Modal
        isOpen={!!detailModal}
        title="Withdrawal Details"
        size="sm"
        onClose={() => setDetailModal(null)}
      >
        {detailModal && (
          <div className="sd__wd-detail">
            <div className="sd__wd-detail-row">
              <span>Amount</span>
              <strong>{formatCurrency(detailModal.amount)}</strong>
            </div>
            <div className="sd__wd-detail-row">
              <span>Method</span>
              <strong>{(detailModal.payout_account?.type || detailModal.method) === 'upi' ? 'UPI' : 'Bank Transfer'}</strong>
            </div>
            {(detailModal.payout_account?.type || detailModal.method) === 'upi' ? (
              <>
                <div className="sd__wd-detail-row">
                  <span>UPI ID</span>
                  <strong>{detailModal.payout_account?.upi_id || detailModal.upi_id || '—'}</strong>
                </div>
                <div className="sd__wd-detail-row">
                  <span>Contact Name</span>
                  <strong>{detailModal.payout_account?.contact_name || '—'}</strong>
                </div>
                <div className="sd__wd-detail-row">
                  <span>Phone Number</span>
                  <strong>{detailModal.payout_account?.phone_number || '—'}</strong>
                </div>
              </>
            ) : (
              <>
                <div className="sd__wd-detail-row">
                  <span>Account Holder</span>
                  <strong>{detailModal.payout_account?.account_holder_name || '—'}</strong>
                </div>
                <div className="sd__wd-detail-row">
                  <span>Bank Name</span>
                  <strong>{detailModal.payout_account?.bank_name || '—'}</strong>
                </div>
                <div className="sd__wd-detail-row">
                  <span>Account Number</span>
                  <strong>{detailModal.payout_account?.account_number || '—'}</strong>
                </div>
                <div className="sd__wd-detail-row">
                  <span>IFSC Code</span>
                  <strong>{detailModal.payout_account?.ifsc_code || '—'}</strong>
                </div>
                <div className="sd__wd-detail-row">
                  <span>Contact Name</span>
                  <strong>{detailModal.payout_account?.contact_name || '—'}</strong>
                </div>
                <div className="sd__wd-detail-row">
                  <span>Phone Number</span>
                  <strong>{detailModal.payout_account?.phone_number || '—'}</strong>
                </div>
              </>
            )}
            <div className="sd__wd-detail-row">
              <span>Status</span>
              <span className={`badge badge--wd-${detailModal.status}`}>
                {detailModal.status.charAt(0).toUpperCase() + detailModal.status.slice(1)}
              </span>
            </div>
            <div className="sd__wd-detail-row">
              <span>Requested</span>
              <strong>{formatDate(detailModal.created_at, 'DD MMM YYYY, hh:mm A')}</strong>
            </div>
            {detailModal.approved_at && (
              <div className="sd__wd-detail-row">
                <span>Approved At</span>
                <strong>{formatDate(detailModal.approved_at, 'DD MMM YYYY, hh:mm A')}</strong>
              </div>
            )}
            {detailModal.admin_note && (
              <div className="sd__wd-detail-row">
                <span>Admin Note</span>
                <strong>{detailModal.admin_note}</strong>
              </div>
            )}
            {detailModal.status === 'pending' && (
              <div className="sd__wd-detail-actions">
                <Button
                  variant="success"
                  size="sm"
                  isLoading={wdActionBusy === detailModal.id}
                  onClick={() => { handleApprove(detailModal); setDetailModal(null); }}
                >
                  Approve
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => { setRejectModal(detailModal); setDetailModal(null); setRejectNote(''); }}
                >
                  Reject
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Reject Modal ── */}
      <Modal
        isOpen={!!rejectModal}
        title="Reject Withdrawal"
        size="sm"
        onClose={() => setRejectModal(null)}
      >
        {rejectModal && (
          <div className="sd__wd-reject-form">
            <p className="sd__wd-reject-desc">
              Rejecting withdrawal of <strong>{formatCurrency(rejectModal.amount)}</strong>.
              The wallet balance will <em>not</em> change.
            </p>
            <label className="sd__wd-reject-label">
              Reason (optional)
              <textarea
                className="sd__wd-reject-textarea"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="e.g. Incorrect bank details provided"
                rows={3}
                maxLength={500}
              />
            </label>
            <div className="sd__wd-detail-actions">
              <Button variant="secondary" size="sm" onClick={() => setRejectModal(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                isLoading={wdActionBusy === rejectModal.id}
                onClick={handleReject}
              >
                Confirm Reject
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
