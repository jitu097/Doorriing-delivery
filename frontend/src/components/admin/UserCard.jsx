import { useState } from 'react';
import { adminService } from '../../services/adminService';
import { Button } from '../common/Button';
import './UserCard.css';

const formatDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
};

export const UserCard = ({ user: initialUser }) => {
  const [user, setUser] = useState(initialUser);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const toggleBlock = async () => {
    setBusy(true);
    setErr(null);
    try {
      const updated = user.is_blocked
        ? await adminService.unblockUser(user.id)
        : await adminService.blockUser(user.id);
      setUser(updated);
    } catch (e) {
      setErr(e?.response?.data?.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const displayName = user.full_name || user.email || 'Unknown';
  const initial     = displayName.charAt(0).toUpperCase();

  return (
    <div className={`user-card ${user.is_blocked ? 'user-card--blocked' : ''}`}>
      <div className="user-card__avatar">{initial}</div>

      <div className="user-card__info">
        <p className="user-card__name">{user.full_name || '—'}</p>
        <p className="user-card__email">{user.email || '—'}</p>
        <p className="user-card__meta">{user.phone || '—'}</p>
        <p className="user-card__joined">Joined: {formatDate(user.created_at)}</p>
      </div>

      <div className="user-card__actions">
        <span className={`badge badge--${user.is_blocked ? 'error' : 'success'}`}>
          {user.is_blocked ? 'Blocked' : 'Active'}
        </span>
        <Button
          variant={user.is_blocked ? 'success' : 'danger'}
          size="sm"
          isLoading={busy}
          onClick={toggleBlock}
        >
          {user.is_blocked ? 'Unblock' : 'Block'}
        </Button>
        {err && <p className="user-card__err">{err}</p>}
      </div>
    </div>
  );
};
