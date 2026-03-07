import './Button.css';

export const Button = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  children,
  ...rest
}) => (
  <button
    className={['btn', `btn--${variant}`, `btn--${size}`, isLoading ? 'btn--loading' : '', className].filter(Boolean).join(' ')}
    disabled={isLoading || rest.disabled}
    {...rest}
  >
    {isLoading ? <span className="btn__spinner" aria-hidden="true" /> : null}
    <span>{children}</span>
  </button>
);
