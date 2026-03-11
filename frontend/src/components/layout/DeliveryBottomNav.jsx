import { NavLink } from 'react-router-dom';
import './DeliveryBottomNav.css';

const NAV_ICONS = {
  Overview: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  Assigned: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><polyline points="9 12 11 14 15 10"/></svg>,
  Active:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  History:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
};

export const DeliveryBottomNav = ({ links }) => (
  <nav className="delivery-bottom-nav">
    {links.map((link) => (
      <NavLink
        key={link.to}
        to={link.to}
        className={({ isActive }) =>
          `delivery-bottom-nav__item${isActive ? ' delivery-bottom-nav__item--active' : ''}`
        }
      >
        <span className="delivery-bottom-nav__icon">{NAV_ICONS[link.label]}</span>
        <span className="delivery-bottom-nav__label">{link.label}</span>
      </NavLink>
    ))}
  </nav>
);
