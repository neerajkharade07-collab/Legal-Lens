import { useRef } from 'react';
import { cn } from '../../utils/cn';
import './Tabs.css';

/**
 * Accessible tab list (ARIA tabs pattern, arrow-key navigation).
 * The caller renders the panel with id `${idPrefix}-panel`.
 */
export function Tabs({ tabs, value, onChange, idPrefix, label, className }) {
  const listRef = useRef(null);

  function handleKeyDown(event) {
    const index = tabs.findIndex((tab) => tab.id === value);
    let next = null;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next === null) return;
    event.preventDefault();
    onChange(tabs[next].id);
    listRef.current?.querySelectorAll('[role="tab"]')[next]?.focus();
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      className={cn('tabs', className)}
      onKeyDown={handleKeyDown}
    >
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            id={`${idPrefix}-tab-${tab.id}`}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel`}
            tabIndex={selected ? 0 : -1}
            className={cn('tabs__tab', selected && 'is-active')}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
            {typeof tab.count === 'number' && <span className="tabs__count">{tab.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
