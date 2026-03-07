import type { ReactNode } from 'react';
import { useDashboardState } from '../../state/context';

interface Props {
  id?: string;
  dotColor: string;
  badge?: ReactNode;
  badgeStyle?: React.CSSProperties;
  name: string;
  trailing?: ReactNode;
  onClick: () => void;
}

export function SidebarItem({ id, dotColor, badge, badgeStyle, name, trailing, onClick }: Props) {
  const { selectedFileName } = useDashboardState();
  const isActive = id != null && id === selectedFileName;

  return (
    <div
      className={`sb-item ${isActive ? 'active' : ''}`}
      data-id={id}
      onClick={onClick}
    >
      <div className="dot" style={{ background: dotColor }} />
      {badge && (
        <span className="badge" style={badgeStyle}>
          {badge}
        </span>
      )}
      <span className="name">{name}</span>
      {trailing}
    </div>
  );
}
