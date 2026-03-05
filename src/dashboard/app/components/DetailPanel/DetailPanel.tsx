import { useDashboardState, useDashboardDispatch } from '../../state/context';
import { ParseDetail } from './ParseDetail';
import { KindsDetail } from './KindsDetail';
import { CheckDetail } from './CheckDetail';
import { FileViewer } from './FileViewer';

export function DetailPanel() {
  const { detailPanel } = useDashboardState();
  const dispatch = useDashboardDispatch();

  return (
    <div id="detail-panel" className={detailPanel.open ? 'open' : ''}>
      <div id="dp-header">
        <span className="dp-title" id="dp-title">
          {getTitle(detailPanel)}
        </span>
        <span
          className="dp-stage-badge"
          id="dp-stage-badge"
          style={getStageBadgeStyle(detailPanel.type)}
        >
          {getStageName(detailPanel.type)}
        </span>
        <button id="dp-close" onClick={() => dispatch({ type: 'CLOSE_DETAIL' })}>
          &times;
        </button>
      </div>
      <div id="dp-body">
        {detailPanel.open && renderContent(detailPanel)}
      </div>
    </div>
  );
}

function getTitle(panel: { type: string | null; payload: unknown }): string {
  if (!panel.type) return '';
  const p = panel.payload as any;
  switch (panel.type) {
    case 'parseDetail': return p?.decl?.name ?? '';
    case 'kindsDetail': return p?.item?.name ?? '';
    case 'checkDetail': return `KS${p?.code}: ${p?.property}`;
    case 'fileViewer': {
      const fn = p?.fileName ?? '';
      const parts = fn.split('/');
      return parts.length <= 2 ? fn : parts.slice(-2).join('/');
    }
    default: return '';
  }
}

function getStageName(type: string | null): string {
  switch (type) {
    case 'parseDetail': return 'PARSE';
    case 'kindsDetail': return 'KINDS';
    case 'checkDetail': return 'CHECK';
    case 'fileViewer': return 'FILE';
    default: return '';
  }
}

function getStageBadgeStyle(type: string | null): React.CSSProperties {
  const colors: Record<string, string> = {
    parseDetail: '#4f8ef7',
    kindsDetail: '#a78bfa',
    checkDetail: '#f87171',
    fileViewer: '#4f8ef7',
  };
  const c = colors[type ?? ''] ?? '#4f8ef7';
  return { background: c + '22', color: c };
}

function renderContent(panel: { type: string | null; payload: unknown }) {
  switch (panel.type) {
    case 'parseDetail': return <ParseDetail payload={panel.payload} />;
    case 'kindsDetail': return <KindsDetail payload={panel.payload} />;
    case 'checkDetail': return <CheckDetail payload={panel.payload} />;
    case 'fileViewer': return <FileViewer payload={panel.payload} />;
    default: return null;
  }
}
