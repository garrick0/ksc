import { useState } from 'react';
import { useDashboardState, useDashboardDispatch } from '../../state/context';
import { shortFileName, kindColor, kindBadge, highlightTS, escHtml } from '../../utils/helpers';
import { SourceTab } from './SourceTab';
import { ASTTab } from './ASTTab';

interface Props {
  payload: unknown;
}

export function FileViewer({ payload }: Props) {
  const { data } = useDashboardState();
  const dispatch = useDashboardDispatch();
  const [tab, setTab] = useState<'source' | 'ast'>('source');
  const [astMode, setAstMode] = useState<'ts' | 'ks'>('ts');

  if (!data) return null;

  const p = payload as { fileName: string };
  const sf = data.parse.sourceFiles.find(f => f.fileName === p.fileName);
  if (!sf) return null;

  const fileDiags = data.check.diagnostics.filter(d => d.file === p.fileName);
  const violationLines = new Set(fileDiags.map(d => d.line));
  const annotations = data.kinds.annotations.filter(a => a.sourceFile === p.fileName);

  const hasTsAST = !!(sf.ast && sf.ast.children);
  const hasKsAST = !!(sf as any).ksAst?.children;
  const hasAST = hasTsAST || hasKsAST;
  const currentAST = astMode === 'ts' ? sf.ast : (sf as any).ksAst;

  return (
    <>
      {/* Stats bar */}
      <div className="fv-stats">
        <span className="fv-stat-badge" style={{ background: 'var(--bg4)', color: 'var(--text3)' }}>
          {sf.lineCount} lines
        </span>
        <span className="fv-stat-badge" style={{ background: 'rgba(79,142,247,0.15)', color: 'var(--parse-color)' }}>
          {sf.declarations.length} declarations
        </span>
        {fileDiags.length > 0 ? (
          <span className="fv-stat-badge" style={{ background: 'rgba(248,113,113,0.15)', color: 'var(--red)' }}>
            {fileDiags.length} violations
          </span>
        ) : (
          <span className="fv-stat-badge" style={{ background: 'rgba(74,222,128,0.12)', color: 'var(--green)' }}>
            clean
          </span>
        )}
      </div>

      {/* Kind annotations */}
      {annotations.length > 0 && (
        <div className="dp-section">
          <div className="dp-label">Kind Annotations</div>
          {annotations.map(a => (
            <span
              key={a.id}
              className="dp-prop-chip"
              style={{
                borderColor: 'var(--blue)', color: 'var(--blue)', background: 'rgba(79,142,247,0.08)',
                cursor: 'pointer', marginRight: 4,
              }}
              onClick={() => {
                dispatch({ type: 'SWITCH_STAGE', stage: 'bind' });
                const def = data.kinds.definitions.find(d => d.name === a.kindName);
                if (def) {
                  setTimeout(() => {
                    dispatch({ type: 'SELECT_NODE', id: def.id });
                    dispatch({ type: 'OPEN_DETAIL', detailType: 'kindsDetail', payload: { item: def, kind: 'definition' } });
                  }, 50);
                }
              }}
            >
              {a.name} : {a.kindName}
            </span>
          ))}
        </div>
      )}

      {/* Diagnostics */}
      {fileDiags.length > 0 && (
        <div className="dp-section">
          <div className="dp-label">Diagnostics</div>
          {fileDiags.map(d => (
            <div
              key={d.id}
              className="dp-diag-item"
              style={{ cursor: 'pointer' }}
              onClick={() => dispatch({ type: 'OPEN_DETAIL', detailType: 'checkDetail', payload: d })}
            >
              <div className="dp-diag-code">
                KS{d.code} — {d.property} <span style={{ color: 'var(--text2)', fontWeight: 400 }}>L{d.line}</span>
              </div>
              <div className="dp-diag-msg">{d.message}</div>
            </div>
          ))}
        </div>
      )}

      {/* Declarations */}
      {sf.declarations.length > 0 && (
        <div className="dp-section">
          <div className="dp-label">Declarations</div>
          {sf.declarations.map(d => (
            <div
              key={d.id}
              className="fv-decl-item"
              onClick={() => dispatch({
                type: 'OPEN_DETAIL', detailType: 'parseDetail',
                payload: { file: sf, decl: d },
              })}
            >
              <span className="dp-badge" style={{
                background: kindColor(d.kind), color: '#fff', fontSize: 9, padding: '1px 5px',
              }}>
                {kindBadge(d.kind)}
              </span>
              <span>{d.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      {(sf.source || hasAST) && (
        <div className="dp-section">
          <div className="fv-tabs">
            <button
              className={`fv-tab ${tab === 'source' ? 'active' : ''}`}
              onClick={() => setTab('source')}
            >
              Source
            </button>
            {hasAST && (
              <button
                className={`fv-tab ${tab === 'ast' ? 'active' : ''}`}
                onClick={() => setTab('ast')}
              >
                AST
              </button>
            )}
            {hasAST && (
              <button
                className="fv-tab"
                onClick={() => {
                  if (currentAST) {
                    dispatch({ type: 'OPEN_ELK_GRAPH', astNode: currentAST, fileName: sf.fileName });
                  }
                }}
              >
                Graph
              </button>
            )}
          </div>

          {tab === 'source' && sf.source && (
            <SourceTab source={sf.source} violationLines={violationLines} />
          )}

          {tab === 'ast' && hasAST && (
            <>
              {hasTsAST && hasKsAST && (
                <div className="ast-mode-toggle">
                  <button
                    className={`ast-mode-btn ${astMode === 'ts' ? 'active' : ''}`}
                    onClick={() => setAstMode('ts')}
                  >
                    TS AST
                  </button>
                  <button
                    className={`ast-mode-btn ${astMode === 'ks' ? 'active' : ''}`}
                    onClick={() => setAstMode('ks')}
                  >
                    KS AST
                  </button>
                </div>
              )}
              {!hasTsAST && hasKsAST && (
                <div className="ast-mode-toggle">
                  <span className="ast-mode-label">KS AST</span>
                </div>
              )}
              {currentAST && <ASTTab astNode={currentAST} isKSMode={astMode === 'ks'} />}
            </>
          )}
        </div>
      )}
    </>
  );
}
