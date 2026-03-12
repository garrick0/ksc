'use client';

import { SavedLesson } from '@/lib/tutorial/storage';

interface LoadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLoad: (save: SavedLesson) => void;
  onDelete: (save: SavedLesson) => void;
  saves: SavedLesson[];
  autoSave: SavedLesson | null;
}

export function LoadDialog({ isOpen, onClose, onLoad, onDelete, saves, autoSave }: LoadDialogProps) {
  if (!isOpen) return null;

  const hasSaves = saves.length > 0 || autoSave !== null;

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
        aria-labelledby="load-dialog-title"
        style={{
          background: 'white',
          borderRadius: '8px',
          padding: '1.5rem',
          minWidth: '500px',
          maxWidth: '90vw',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="load-dialog-title" style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: 600 }}>
          Load Save
        </h2>

        {!hasSaves && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
            <p>No saves found for this lesson.</p>
            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
              Click "Save as..." to create a save point.
            </p>
          </div>
        )}

        {hasSaves && (
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
            {autoSave && (
              <>
                <SaveItem
                  save={autoSave}
                  isAutoSave
                  onLoad={onLoad}
                  onDelete={onDelete}
                />
                {saves.length > 0 && <Divider />}
              </>
            )}

            {saves.map((save) => (
              <SaveItem
                key={`${save.lessonSlug}:${save.slotName}`}
                save={save}
                onLoad={onLoad}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
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
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

interface SaveItemProps {
  save: SavedLesson;
  isAutoSave?: boolean;
  onLoad: (save: SavedLesson) => void;
  onDelete: (save: SavedLesson) => void;
}

function SaveItem({ save, isAutoSave = false, onLoad, onDelete }: SaveItemProps) {
  const timeAgo = getTimeAgo(save.timestamp);
  const label = isAutoSave ? 'Auto-save' : save.label || save.slotName || 'Unnamed save';

  return (
    <div
      style={{
        padding: '0.75rem',
        borderRadius: '4px',
        border: '1px solid #e5e7eb',
        marginBottom: '0.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
          {isAutoSave && <span style={{ marginRight: '0.5rem' }}>⚡</span>}
          {label}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
          {save.files.length} files • {timeAgo}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={() => onLoad(save)}
          style={{
            padding: '0.375rem 0.75rem',
            border: 'none',
            borderRadius: '4px',
            background: '#3b82f6',
            color: 'white',
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontWeight: 600,
          }}
        >
          Load
        </button>
        <button
          onClick={() => {
            if (confirm(`Delete "${label}"?`)) {
              onDelete(save);
            }
          }}
          style={{
            padding: '0.375rem 0.75rem',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            background: 'white',
            color: '#dc2626',
            cursor: 'pointer',
            fontSize: '0.75rem',
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        height: '1px',
        background: '#e5e7eb',
        margin: '0.75rem 0',
      }}
    />
  );
}

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  const date = new Date(timestamp);
  return date.toLocaleDateString();
}
