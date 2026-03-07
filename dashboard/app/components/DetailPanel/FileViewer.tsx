import { useState } from 'react';
import { useDashboardState } from '../../state/context';
import { SourceTab } from './SourceTab';
import { ASTTab } from './ASTTab';
import { GraphTab } from './GraphTab';

interface Props {
  payload: unknown;
}

export function FileViewer({ payload }: Props) {
  const { data } = useDashboardState();
  const [tab, setTab] = useState<'source' | 'ast' | 'graph'>('source');

  if (!data) return null;

  const p = payload as { fileName: string };
  const sf = data.files.find(f => f.fileName === p.fileName);
  if (!sf) return null;

  const hasAST = !!(sf.ast && sf.ast.children);

  return (
    <>
      {/* Stats bar */}
      <div className="fv-stats">
        <span className="fv-stat-badge" style={{ background: 'var(--bg4)', color: 'var(--text3)' }}>
          {sf.lineCount} lines
        </span>
      </div>

      {/* Tabs */}
      <div className={tab === 'graph' || tab === 'ast' ? 'dp-section dp-section-flex' : 'dp-section'}>
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
              className={`fv-tab ${tab === 'graph' ? 'active' : ''}`}
              onClick={() => setTab('graph')}
            >
              Graph
            </button>
          )}
        </div>

        {tab === 'source' && sf.source && (
          <SourceTab source={sf.source} violationLines={new Set()} />
        )}

        {tab === 'ast' && hasAST && (
          <ASTTab astNode={sf.ast} source={sf.source} schema={data.schema} />
        )}

        {tab === 'graph' && hasAST && (
          <GraphTab astNode={sf.ast} fileName={sf.fileName} />
        )}
      </div>
    </>
  );
}
