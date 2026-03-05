import { useDashboardState, useDashboardDispatch } from '../../state/context';
import { highlightTS } from '../../utils/helpers';

interface Props {
  payload: unknown;
}

export function CheckDetail({ payload }: Props) {
  const { data } = useDashboardState();
  const dispatch = useDashboardDispatch();
  const diag = payload as {
    id: string; file: string; code: number; property: string;
    message: string; start: number; length: number; line: number; column: number;
  };
  if (!data) return null;

  const sf = data.parse.sourceFiles.find(f => f.fileName === diag.file);

  return (
    <>
      <div className="dp-section">
        <div className="dp-label">Error Code</div>
        <span className="dp-badge" style={{ background: 'rgba(248,113,113,0.15)', color: 'var(--red)' }}>
          KS{diag.code}
        </span>
      </div>

      <div className="dp-section">
        <div className="dp-label">Property</div>
        <span className="dp-prop-chip" style={{
          borderColor: 'var(--red)', color: 'var(--red)', background: 'rgba(248,113,113,0.08)', display: 'inline-block',
        }}>
          {diag.property}
        </span>
      </div>

      <div className="dp-section">
        <div className="dp-label">Message</div>
        <div style={{ color: 'var(--text)' }}>{diag.message}</div>
      </div>

      <div className="dp-section">
        <div className="dp-label">Location</div>
        <div className="dp-value" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
          {diag.file}:{diag.line}:{diag.column}
        </div>
      </div>

      {sf?.source && (
        <div className="dp-section">
          <div className="dp-label">Source</div>
          <div className="fv-code-wrap">
            {sf.source.split('\n').map((line, i) => {
              const lineNum = i + 1;
              const isViolation = lineNum === diag.line;
              return (
                <div key={i} className={`fv-line ${isViolation ? 'violation' : ''}`}>
                  <span className="fv-ln">{lineNum}</span>
                  <span className="fv-code" dangerouslySetInnerHTML={{ __html: highlightTS(line) }} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="dp-section" style={{ display: 'flex', gap: 6 }}>
        <button
          className="dp-nav-btn"
          onClick={() => dispatch({
            type: 'OPEN_DETAIL', detailType: 'fileViewer', payload: { fileName: diag.file },
          })}
        >
          View File →
        </button>
        <button className="dp-nav-btn" onClick={() => dispatch({ type: 'SWITCH_STAGE', stage: 'parse' })}>
          Show in Parse →
        </button>
      </div>
    </>
  );
}
