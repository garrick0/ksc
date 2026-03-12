'use client';

import { useState, useRef, useEffect } from 'react';

interface SaveMenuProps {
  onSave: () => void;
  onLoad: () => void;
  onExport: () => void;
  onReset: () => void;
  disabled?: boolean;
}

export function SaveMenu({ onSave, onLoad, onExport, onReset, disabled = false }: SaveMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <div style={{ position: 'relative' }} ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Save and load options"
        style={{
          background: '#64748b',
          color: 'white',
          border: 'none',
          padding: '0.5rem 0.75rem',
          borderRadius: '4px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: '0.875rem',
          fontWeight: 600,
          opacity: disabled ? 0.5 : 1,
        }}
        title="Save/Load options"
      >
        ⋮
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Save and load options"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '4px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            minWidth: '180px',
            zIndex: 1000,
          }}
        >
          <MenuItem
            label="Save as..."
            shortcut="Ctrl+S"
            onClick={() => handleAction(onSave)}
            icon="💾"
          />
          <MenuItem
            label="Load save..."
            onClick={() => handleAction(onLoad)}
            icon="📂"
          />
          <MenuDivider />
          <MenuItem
            label="Download ZIP"
            onClick={() => handleAction(onExport)}
            icon="📦"
          />
          <MenuDivider />
          <MenuItem
            label="Reset to starter"
            onClick={() => handleAction(onReset)}
            icon="↺"
          />
        </div>
      )}
    </div>
  );
}

interface MenuItemProps {
  label: string;
  onClick: () => void;
  icon?: string;
  shortcut?: string;
}

function MenuItem({ label, onClick, icon, shortcut }: MenuItemProps) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '0.5rem 0.75rem',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        fontSize: '0.875rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.5rem',
        color: '#1f2937',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#f3f4f6';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {icon && <span>{icon}</span>}
        <span style={{ color: '#1f2937' }}>{label}</span>
      </span>
      {shortcut && (
        <span
          style={{
            fontSize: '0.75rem',
            color: '#6b7280',
            fontFamily: 'monospace',
          }}
        >
          {shortcut}
        </span>
      )}
    </button>
  );
}

function MenuDivider() {
  return (
    <div
      style={{
        height: '1px',
        background: '#e5e7eb',
        margin: '0.25rem 0',
      }}
    />
  );
}
