'use client';

import { useState, useEffect, useRef } from 'react';

interface SaveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  defaultName?: string;
}

export function SaveDialog({ isOpen, onClose, onSave, defaultName }: SaveDialogProps) {
  const [name, setName] = useState(defaultName || getDefaultSaveName());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(defaultName || getDefaultSaveName());
      // Focus input after a brief delay to ensure it's mounted
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, defaultName]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName) {
      onSave(trimmedName);
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-labelledby="save-dialog-title"
        style={{
          background: 'white',
          borderRadius: '8px',
          padding: '1.5rem',
          minWidth: '400px',
          maxWidth: '90vw',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="save-dialog-title" style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: 600 }}>
          Save Progress
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="save-name"
              style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}
            >
              Save name
            </label>
            <input
              ref={inputRef}
              id="save-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., My solution"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '0.875rem',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                background: 'white',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                borderRadius: '4px',
                background: name.trim() ? '#3b82f6' : '#d1d5db',
                color: 'white',
                cursor: name.trim() ? 'pointer' : 'not-allowed',
                fontSize: '0.875rem',
                fontWeight: 600,
              }}
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function getDefaultSaveName(): string {
  const now = new Date();
  const month = now.toLocaleString('default', { month: 'short' });
  const day = now.getDate();
  const time = now.toLocaleTimeString('default', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${month} ${day}, ${time}`;
}
