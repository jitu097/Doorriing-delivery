import './Navbar.css';

export const Navbar = ({ title, onLogout, user, onMenuToggle }) => (
  <header className="navbar">
    <div className="navbar__left">
      <button className="navbar__hamburger" onClick={onMenuToggle} aria-label="Toggle menu">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      <h1 className="navbar__title">{title}</h1>
    </div>
    <div className="navbar__right">
      {user && (
        <div className="navbar__user">
          <div className="navbar__avatar">{user.email?.[0]?.toUpperCase() ?? '?'}</div>
          <span className="navbar__email">{user.email}</span>
        </div>
      )}
      <button className="navbar__logout" onClick={onLogout}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        <span className="navbar__logout-label">Logout</span>
      </button>
    </div>
  </header>
);
