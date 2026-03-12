'use client';

interface ResumeBannerProps {
  onRestore: () => void;
  onDismiss: () => void;
}

export function ResumeBanner({ onRestore, onDismiss }: ResumeBannerProps) {
  return (
    <div
      role="alert"
      style={{
        background: '#3b82f6',
        color: 'white',
        padding: '0.75rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.875rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span>⚡</span>
        <span>Resume where you left off?</span>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={onRestore}
          style={{
            background: 'white',
            color: '#3b82f6',
            border: 'none',
            padding: '0.375rem 0.75rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          Restore
        </button>
        <button
          onClick={onDismiss}
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            color: 'white',
            border: 'none',
            padding: '0.375rem 0.75rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
