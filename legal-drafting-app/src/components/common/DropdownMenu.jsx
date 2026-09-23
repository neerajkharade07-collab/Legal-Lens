import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '../../utils/cn';
import './DropdownMenu.css';

/**
 * Accessible menu button. items: [{ id, label, icon, onSelect, disabled }]
 * Arrow keys move, Enter/Space select, Escape / outside click close.
 */
export function DropdownMenu({
  label,
  icon: Icon,
  items,
  align = 'end',
  buttonClassName,
  buttonLabel,
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    menuRef.current?.querySelector('[role="menuitem"]:not([disabled])')?.focus();
    const onPointer = (event) => {
      if (!menuRef.current?.contains(event.target) && !buttonRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  function close(focusButton = true) {
    setOpen(false);
    if (focusButton) buttonRef.current?.focus();
  }

  function onMenuKeyDown(event) {
    const nodes = [...menuRef.current.querySelectorAll('[role="menuitem"]:not([disabled])')];
    const index = nodes.indexOf(document.activeElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      nodes[(index + 1) % nodes.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      nodes[(index - 1 + nodes.length) % nodes.length]?.focus();
    } else if (event.key === 'Tab') {
      close(false);
    }
  }

  return (
    <div className="dropdown">
      <button
        ref={buttonRef}
        type="button"
        className={cn('btn btn--secondary btn--sm', buttonClassName)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={buttonLabel}
        onClick={() => setOpen((v) => !v)}
      >
        {Icon && <Icon size={16} strokeWidth={1.75} aria-hidden="true" />}
        {label && <span className="btn__label">{label}</span>}
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          className={cn('dropdown__menu', `dropdown__menu--${align}`)}
          onKeyDown={onMenuKeyDown}
        >
          {items.map((item) => {
            const ItemIcon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className="dropdown__item"
                disabled={item.disabled}
                onClick={() => {
                  close();
                  item.onSelect?.();
                }}
              >
                {ItemIcon && <ItemIcon size={16} strokeWidth={1.75} aria-hidden="true" />}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
