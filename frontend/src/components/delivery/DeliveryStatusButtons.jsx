import './DeliveryStatusButtons.css';

export const DeliveryStatusButtons = ({ isOnline = true, onToggle }) => (
  <div className="dsb">
    <span className={`dsb__dot ${isOnline ? 'dsb__dot--online' : 'dsb__dot--offline'}`} />
    <span className="dsb__label">{isOnline ? 'Online' : 'Offline'}</span>
    <button className={`dsb__toggle ${isOnline ? 'dsb__toggle--online' : ''}`} onClick={onToggle}>
      {isOnline ? 'Go Offline' : 'Go Online'}
    </button>
  </div>
);
