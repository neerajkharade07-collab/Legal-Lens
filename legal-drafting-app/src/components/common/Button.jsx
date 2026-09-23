import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';
import './Button.css';

/**
 * Button — renders <button>, or a router <Link> when `to` is passed.
 * variant: primary | secondary | ghost | link
 * size: sm | md | lg
 */
export const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    to,
    icon: Icon,
    iconRight: IconRight,
    fullWidth = false,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  const classes = cn(
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    fullWidth && 'btn--full',
    !children && 'btn--icon-only',
    className,
  );
  const iconSize = size === 'lg' ? 18 : 16;
  const content = (
    <>
      {Icon && <Icon size={iconSize} strokeWidth={1.75} aria-hidden="true" />}
      {children && <span className="btn__label">{children}</span>}
      {IconRight && <IconRight size={iconSize} strokeWidth={1.75} aria-hidden="true" />}
    </>
  );

  if (to) {
    return (
      <Link ref={ref} to={to} className={classes} {...rest}>
        {content}
      </Link>
    );
  }

  return (
    <button ref={ref} type={type} className={classes} {...rest}>
      {content}
    </button>
  );
});
