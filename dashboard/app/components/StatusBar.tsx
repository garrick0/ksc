import { useDashboardState } from '../state/context';

export function StatusBar() {
  const { data } = useDashboardState();
  if (!data) return <div id="statusbar" />;

  const totalNodes = data.files.reduce((sum, f) => sum + countNodes(f.ast), 0);

  return (
    <div id="statusbar">
      <div className="stat">
        <div className="sb-dot" style={{ background: 'var(--parse-color)' }} />
        <strong>{data.files.length}</strong> source files
      </div>
      <div className="stat">
        <div className="sb-dot" style={{ background: 'var(--blue)' }} />
        <strong>{totalNodes}</strong> AST nodes
      </div>
    </div>
  );
}

function countNodes(node: { children?: { children?: any }[] }): number {
  let count = 1;
  if (node.children) {
    for (const child of node.children) count += countNodes(child);
  }
  return count;
}
