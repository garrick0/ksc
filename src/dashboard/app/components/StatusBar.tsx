import { useDashboardState } from '../state/context';

export function StatusBar() {
  const { data } = useDashboardState();
  if (!data) return <div id="statusbar" />;

  const diags = data.check.diagnostics;
  const clean = data.check.summary.cleanFiles;

  return (
    <div id="statusbar">
      <div className="stat">
        <div className="sb-dot" style={{ background: 'var(--parse-color)' }} />
        <strong>{data.parse.sourceFiles.length}</strong> source files
      </div>
      <div className="stat">
        <div className="sb-dot" style={{ background: 'var(--bind-color)' }} />
        <strong>{data.kinds.definitions.length}</strong> kinds
      </div>
      <div className="stat">
        <div className="sb-dot" style={{ background: 'var(--green)' }} />
        <strong>{clean}</strong> clean
      </div>
      <div className="stat">
        <div className="sb-dot" style={{ background: 'var(--red)' }} />
        <strong>{diags.length}</strong> diagnostics
      </div>
    </div>
  );
}
