import { useDashboardState, useDashboardDispatch } from '../../state/context';
import { escHtml, shortFileName } from '../../utils/helpers';

interface Props {
  payload: unknown;
}

export function KindsDetail({ payload }: Props) {
  const { data } = useDashboardState();
  const dispatch = useDashboardDispatch();
  if (!data) return null;

  const p = payload as { item: any; kind: 'definition' | 'annotation' };

  if (p.kind === 'definition') return <DefinitionDetail def={p.item} />;
  return <AnnotationDetail ann={p.item} />;
}

function DefinitionDetail({ def }: { def: any }) {
  const { data } = useDashboardState();
  const dispatch = useDashboardDispatch();
  if (!data) return null;

  const props = def.properties;
  const propKeys = Object.keys(props).filter((k: string) => props[k]);
  const relatedAnns = data.kinds.annotations.filter(a => a.kindName === def.name);
  const annFiles = new Set(relatedAnns.map(a => a.sourceFile));
  const diags = data.check.diagnostics.filter(d => annFiles.has(d.file));

  return (
    <>
      <div className="dp-section">
        <div className="dp-label">Type</div>
        <span className="dp-badge" style={{ background: 'var(--blue)22', color: 'var(--blue)' }}>
          Definition
        </span>
      </div>

      {propKeys.length > 0 && (
        <div className="dp-section">
          <div className="dp-label">Properties</div>
          <div className="dp-props">
            {propKeys.map(p => (
              <span key={p} className="dp-prop-chip" style={{
                borderColor: 'var(--green)', color: 'var(--green)', background: 'rgba(74,222,128,0.08)',
              }}>
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="dp-section">
        <div className="dp-label">Source File</div>
        <div
          className="dp-value"
          style={{ fontFamily: 'var(--mono)', fontSize: 11, cursor: 'pointer' }}
          onClick={() => dispatch({
            type: 'OPEN_DETAIL', detailType: 'fileViewer', payload: { fileName: def.sourceFile },
          })}
        >
          {def.sourceFile}
        </div>
      </div>

      {relatedAnns.length > 0 && (
        <div className="dp-section">
          <div className="dp-label">Annotations ({relatedAnns.length})</div>
          <div className="dp-file-list">
            {relatedAnns.map(a => {
              const hasDiag = data.check.diagnostics.some(d => d.file === a.sourceFile);
              return (
                <div
                  key={a.id}
                  className="dp-file-item"
                  onClick={() => dispatch({
                    type: 'OPEN_DETAIL', detailType: 'kindsDetail', payload: { item: a, kind: 'annotation' },
                  })}
                >
                  <div className="fi-dot" style={{ background: hasDiag ? 'var(--red)' : 'var(--green)' }} />
                  {a.name}{' '}
                  <span style={{ color: 'var(--text2)', fontSize: 10 }}>{shortFileName(a.sourceFile)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {diags.length > 0 ? (
        <div className="dp-section">
          <div className="dp-label">Diagnostics ({diags.length})</div>
          {diags.map(d => (
            <div key={d.id} className="dp-diag-item">
              <div className="dp-diag-code">KS{d.code} — {d.property}</div>
              <div className="dp-diag-msg">{d.message}</div>
              <div className="dp-diag-loc">{d.file}:{d.line}</div>
            </div>
          ))}
          <button className="dp-nav-btn" onClick={() => dispatch({ type: 'SWITCH_STAGE', stage: 'check' })}>
            Show in Check →
          </button>
        </div>
      ) : (
        <div className="dp-section" style={{ color: 'var(--green)', fontWeight: 600 }}>
          ✓ No violations
        </div>
      )}
    </>
  );
}

function AnnotationDetail({ ann }: { ann: any }) {
  const { data } = useDashboardState();
  const dispatch = useDashboardDispatch();
  if (!data) return null;

  const diags = data.check.diagnostics.filter(d => d.file === ann.sourceFile);

  return (
    <>
      <div className="dp-section">
        <div className="dp-label">Type</div>
        <span className="dp-badge" style={{ background: 'var(--cyan)22', color: 'var(--cyan)' }}>
          Annotation
        </span>
      </div>

      <div className="dp-section">
        <div className="dp-label">Kind</div>
        <span
          className="dp-prop-chip"
          style={{ borderColor: 'var(--blue)', color: 'var(--blue)', background: 'rgba(79,142,247,0.08)', cursor: 'pointer' }}
          onClick={() => {
            dispatch({ type: 'SWITCH_STAGE', stage: 'bind' });
            const def = data.kinds.definitions.find(d => d.name === ann.kindName);
            if (def) {
              setTimeout(() => {
                dispatch({ type: 'SELECT_NODE', id: def.id });
                dispatch({ type: 'OPEN_DETAIL', detailType: 'kindsDetail', payload: { item: def, kind: 'definition' } });
              }, 50);
            }
          }}
        >
          {ann.kindName}
        </span>
      </div>

      <div className="dp-section">
        <div className="dp-label">Source File</div>
        <div
          className="dp-value"
          style={{ fontFamily: 'var(--mono)', fontSize: 11, cursor: 'pointer' }}
          onClick={() => dispatch({
            type: 'OPEN_DETAIL', detailType: 'fileViewer', payload: { fileName: ann.sourceFile },
          })}
        >
          {ann.sourceFile}
        </div>
      </div>

      {diags.length > 0 ? (
        <div className="dp-section">
          <div className="dp-label">Diagnostics ({diags.length})</div>
          {diags.map(d => (
            <div key={d.id} className="dp-diag-item">
              <div className="dp-diag-code">KS{d.code} — {d.property}</div>
              <div className="dp-diag-msg">{d.message}</div>
              <div className="dp-diag-loc">{d.file}:{d.line}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="dp-section" style={{ color: 'var(--green)', fontWeight: 600 }}>
          ✓ No violations
        </div>
      )}
    </>
  );
}
