import { useDashboardDispatch } from '../../state/context';
import { escHtml, kindColor, highlightTS } from '../../utils/helpers';
import type { DashboardExportData } from '../../types';

interface Props {
  payload: unknown;
}

export function ParseDetail({ payload }: Props) {
  const dispatch = useDashboardDispatch();
  const p = payload as {
    file: DashboardExportData['parse']['sourceFiles'][0];
    decl: DashboardExportData['parse']['sourceFiles'][0]['declarations'][0];
  };
  const { file: sf, decl } = p;

  return (
    <>
      <div className="dp-section">
        <div className="dp-label">File</div>
        <div className="dp-value">{sf.fileName}</div>
      </div>
      <div className="dp-section">
        <div className="dp-label">Kind</div>
        <span className="dp-badge" style={{ background: kindColor(decl.kind), color: '#fff' }}>
          {decl.kind}
        </span>
      </div>
      <div className="dp-section">
        <div className="dp-label">Position</div>
        <div className="dp-value" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
          pos: {decl.pos} — end: {decl.end}
        </div>
      </div>
      <div className="dp-section">
        <div className="dp-label">Source Preview</div>
        <div className="dp-code-block">{decl.text}</div>
      </div>

      {sf.source && (
        <div className="dp-section">
          <div className="dp-label">Full Source</div>
          <div className="fv-code-wrap">
            {sf.source.split('\n').map((line, i) => (
              <div key={i} className="fv-line">
                <span className="fv-ln">{i + 1}</span>
                <span className="fv-code" dangerouslySetInnerHTML={{ __html: highlightTS(line) }} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="dp-section">
        <button
          className="dp-nav-btn"
          onClick={() => dispatch({
            type: 'OPEN_DETAIL',
            detailType: 'fileViewer',
            payload: { fileName: sf.fileName },
          })}
        >
          View File →
        </button>
      </div>
    </>
  );
}
