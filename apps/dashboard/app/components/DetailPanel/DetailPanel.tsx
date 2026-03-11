import { useDashboardState, useDashboardDispatch } from '../../state/context';
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
          style={{ background: '#4f8ef722', color: '#4f8ef7' }}
        >
          FILE
        </span>
        <button id="dp-close" onClick={() => dispatch({ type: 'CLOSE_DETAIL' })}>
          &times;
        </button>
      </div>
      <div id="dp-body">
        {detailPanel.open && detailPanel.type === 'fileViewer' && (
          <FileViewer payload={detailPanel.payload} />
        )}
      </div>
    </div>
  );
}

function getTitle(panel: { type: string | null; payload: unknown }): string {
  if (panel.type !== 'fileViewer') return '';
  const p = panel.payload as any;
  const fn = p?.fileName ?? '';
  const parts = fn.split('/');
  return parts.length <= 2 ? fn : parts.slice(-2).join('/');
}
