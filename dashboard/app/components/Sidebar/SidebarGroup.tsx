import { useState, type ReactNode } from 'react';

interface Props {
  header: ReactNode;
  count?: number;
  defaultCollapsed?: boolean;
  headerColor?: string;
  onHeaderAction?: () => void;
  children: ReactNode;
}

export function SidebarGroup({ header, count, defaultCollapsed = false, headerColor, onHeaderAction, children }: Props) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div className="sb-group">
      <div
        className={`sb-group-header ${collapsed ? 'collapsed' : ''}`}
        onClick={(e) => {
          if (onHeaderAction && (e.target as HTMLElement).dataset.action === 'view') {
            onHeaderAction();
            return;
          }
          setCollapsed(!collapsed);
        }}
      >
        <span className="chevron">{'\u25BE'}</span>
        {headerColor && <span style={{ color: headerColor }}>{'\u25CF'}</span>}
        {' '}{header}
        {count != null && (
          <span style={{ color: headerColor ?? 'var(--text2)', fontSize: 10, fontWeight: 400 }}>
            ({count})
          </span>
        )}
      </div>
      <div className={`sb-group-body ${collapsed ? 'collapsed' : ''}`}>
        {children}
      </div>
    </div>
  );
}
