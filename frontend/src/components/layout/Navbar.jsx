import './Navbar.css';

export const Navbar = ({ title, onLogout, user }) => (
  <header className="navbar">
    <div className="navbar__left">
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
        Logout
      </button>
    </div>
  </header>
);
