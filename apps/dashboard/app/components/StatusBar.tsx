import { useDashboardState } from '../state/context';

const depthColors: Record<string, string> = {
  parse: 'var(--parse-color)',
  bind: 'var(--bind-color)',
  check: 'var(--check-color)',
};

export function StatusBar() {
  const { data } = useDashboardState();
  if (!data) return <div id="statusbar" />;

  const totalNodes = data.files.reduce((sum, f) => sum + countNodes(f.ast), 0);
  const totalProps = data.files.reduce((sum, f) => sum + countProps(f.ast), 0);
  const depth = data.analysisDepth ?? 'parse';
  const color = depthColors[depth] ?? depthColors.parse;

  return (
    <div id="statusbar">
      <div className="stat">
        <div className="sb-dot" style={{ background: color }} />
        <strong>{depth}</strong> depth
      </div>
      <div className="stat">
        <div className="sb-dot" style={{ background: 'var(--parse-color)' }} />
        <strong>{data.files.length}</strong> files
      </div>
      <div className="stat">
        <div className="sb-dot" style={{ background: 'var(--blue)' }} />
        <strong>{totalNodes}</strong> nodes
      </div>
      <div className="stat">
        <div className="sb-dot" style={{ background: 'var(--cyan)' }} />
        <strong>{totalProps}</strong> props
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

function countProps(node: { props?: Record<string, unknown>; children?: any[] }): number {
  let count = node.props ? Object.keys(node.props).length : 0;
  if (node.children) {
    for (const child of node.children) count += countProps(child);
  }
  return count;
}
