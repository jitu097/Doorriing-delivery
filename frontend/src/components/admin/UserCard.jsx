import { useState } from 'react';
import { adminService } from '../../services/adminService';
import { Button } from '../common/Button';
import './UserCard.css';

export const UserCard = ({ user: initialUser }) => {
  const [user, setUser] = useState(initialUser);
  const [busy, setBusy] = useState(false);

  const toggleBlock = async () => {
    setBusy(true);
    try {
      await adminService.setUserBlock(user.id, !user.is_blocked);
      setUser({ ...user, is_blocked: !user.is_blocked });
    } finally {
      setBusy(false);
    }
  };

  const initial = (user.name || user.email || 'U').charAt(0).toUpperCase();

  return (
    <div className={`user-card ${user.is_blocked ? 'user-card--blocked' : ''}`}>
      <div className="user-card__avatar">{initial}</div>
      <div className="user-card__info">
        <p className="user-card__name">{user.name || '—'}</p>
        <p className="user-card__email">{user.email}</p>
        <p className="user-card__meta">{user.phone || ''}</p>
      </div>
      <div className="user-card__actions">
        <span className={`badge badge--${user.is_blocked ? 'blocked' : 'active'}`}>
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
      </div>
    </div>
  );
};
