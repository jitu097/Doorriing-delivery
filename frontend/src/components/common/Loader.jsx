import { memo } from 'react';
import './Loader.css';

export const Loader = memo(({ label = '', fullPage = false }) => (
  <div className={fullPage ? 'loader loader--full' : 'loader'}>
    <span className="loader__ring" aria-hidden="true" />
    {label && <span className="loader__label">{label}</span>}
  </div>
));
