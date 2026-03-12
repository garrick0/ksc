'use client';

interface EditorTabsProps {
  tabs: string[];
  activeTab: string | null;
  onTabSelect: (path: string) => void;
  onTabClose: (path: string) => void;
  onSplitToggle?: () => void;
  isSplit?: boolean;
  showSolution?: boolean;
  onCopy?: () => void;
  side?: 'left' | 'right';
}

export function EditorTabs({
  tabs,
  activeTab,
  onTabSelect,
  onTabClose,
  onSplitToggle,
  isSplit,
  showSolution,
  onCopy,
  side,
}: EditorTabsProps) {
  const fileName = (path: string) => path.split('/').pop() || path;

  return (
    <div
      style={{
        background: '#2d2d30',
        display: 'flex',
        alignItems: 'stretch',
        borderBottom: '1px solid #3e3e42',
        minHeight: '35px',
      }}
    >
      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Open files"
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        {tabs.map((tab) => (
          <div
            key={tab}
            role="tab"
            aria-selected={tab === activeTab}
            onClick={() => onTabSelect(tab)}
            title={tab}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0 0.75rem',
              fontSize: '0.8125rem',
              color: tab === activeTab ? '#fff' : '#999',
              background: tab === activeTab ? '#1e1e1e' : 'transparent',
              borderRight: '1px solid #3e3e42',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              userSelect: 'none',
            }}
            onMouseDown={(e) => {
              // Middle-click to close
              if (e.button === 1) {
                e.preventDefault();
                onTabClose(tab);
              }
            }}
          >
            <span>{fileName(tab)}</span>
            <span
              role="button"
              aria-label={`Close ${fileName(tab)}`}
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab);
              }}
              style={{
                fontSize: '0.875rem',
                lineHeight: 1,
                color: '#666',
                cursor: 'pointer',
                padding: '2px',
                borderRadius: '3px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.background = '#555';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#666';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              ×
            </span>
          </div>
        ))}
      </div>

      {/* Right-side actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0 0.5rem',
        }}
      >
        {showSolution && (
          <span style={{ color: '#10b981', fontSize: '0.75rem', marginRight: '0.25rem' }}>✓ Solution</span>
        )}

        {onCopy && activeTab && (
          <button
            onClick={onCopy}
            title="Copy file contents"
            aria-label="Copy file contents"
            style={{
              background: 'transparent',
              color: '#999',
              border: 'none',
              padding: '3px 6px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '0.75rem',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#fff';
              e.currentTarget.style.background = '#3e3e42';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#999';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            📋
          </button>
        )}

        {onSplitToggle && !side && (
          <button
            onClick={onSplitToggle}
            title={isSplit ? 'Close split view' : 'Split editor'}
            aria-label={isSplit ? 'Close split view' : 'Split editor'}
            style={{
              background: 'transparent',
              color: isSplit ? '#3b82f6' : '#999',
              border: 'none',
              padding: '3px 6px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '0.8125rem',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#fff';
              e.currentTarget.style.background = '#3e3e42';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = isSplit ? '#3b82f6' : '#999';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            ⫿
          </button>
        )}

        {side === 'right' && onSplitToggle && (
          <button
            onClick={onSplitToggle}
            title="Close split"
            aria-label="Close split view"
            style={{
              background: 'transparent',
              color: '#999',
              border: 'none',
              padding: '3px 6px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '0.8125rem',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#fff';
              e.currentTarget.style.background = '#3e3e42';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#999';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
