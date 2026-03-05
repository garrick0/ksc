import { useDashboardState, useDashboardDispatch } from '../state/context';
import { SAMPLE_DATA } from '../sampleData';

export function Header() {
  const { data } = useDashboardState();
  const dispatch = useDashboardDispatch();

  return (
    <div id="header">
      <span className="logo">KindScript</span>
      <span className="sep">/</span>
      <span className="title">Compiler Dashboard</span>
      <div className="spacer" />
      {data && (
        <div className="stats-badge">
          <strong>{data.parse.sourceFiles.length}</strong> files
          {' \u00b7 '}
          <strong>{data.kinds.definitions.length}</strong> kinds
          {' \u00b7 '}
          <strong>{data.check.diagnostics.length}</strong> diagnostics
        </div>
      )}
      <button onClick={() => dispatch({ type: 'SET_UPLOAD_OVERLAY', open: true })}>
        Load JSON
      </button>
      <button onClick={() => dispatch({ type: 'LOAD_DATA', data: SAMPLE_DATA })}>
        Sample Data
      </button>
    </div>
  );
}
