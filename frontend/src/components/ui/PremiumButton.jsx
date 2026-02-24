/**
 * Premium Button Component
 * Production-ready button with premium feel
 */

import React from 'react';
import './PremiumButton.css';

const PremiumButton = ({
  children,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon = null,
  iconPosition = 'left',
  onClick,
  type = 'button',
  className = '',
  ...props
}) => {
  const buttonClasses = [
    'premium-btn',
    `premium-btn-${variant}`,
    `premium-btn-${size}`,
    fullWidth && 'premium-btn-full-width',
    loading && 'premium-btn-loading',
    disabled && 'premium-btn-disabled',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const handleClick = (e) => {
    if (disabled || loading) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };

  return (
    <button
      type={type}
      className={buttonClasses}
      onClick={handleClick}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="premium-btn-spinner">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
          </svg>
        </span>
      )}

      {!loading && icon && iconPosition === 'left' && (
        <span className="premium-btn-icon premium-btn-icon-left">{icon}</span>
      )}

      <span className="premium-btn-text">{children}</span>

      {!loading && icon && iconPosition === 'right' && (
        <span className="premium-btn-icon premium-btn-icon-right">{icon}</span>
      )}
    </button>
  );
};

export default PremiumButton;
