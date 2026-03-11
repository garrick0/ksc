import type { ELKNodeData } from './elkHelpers';

interface Props {
  node: ELKNodeData;
  label: string;
  onClose: () => void;
}

export function ELKGraphDetail({ node, label, onClose }: Props) {
  const astN = node._astNode;
  const rows: [string, string][] = [['Kind', astN.kind]];
  if (astN.name) rows.push(['Name', astN.name]);
  rows.push(['Pos', `${astN.pos} \u2014 ${astN.end}`]);
  if (astN.children?.length > 0) rows.push(['Children', '' + astN.children.length]);
  if (node._isCollapsed) rows.push(['Hidden', node._childCount + ' descendants']);
  if (astN.text?.length > 0) rows.push(['Text', astN.text.length > 80 ? astN.text.slice(0, 77) + '...' : astN.text]);

  // Show key props
  const props = astN.props;
  if (props) {
    if (props.typeString) rows.push(['Type', String(props.typeString).length > 60 ? String(props.typeString).slice(0, 57) + '...' : String(props.typeString)]);
    if (props.escapedText) rows.push(['Text', String(props.escapedText)]);
    if (props.declarationKind) rows.push(['Decl', String(props.declarationKind)]);
    if (props.isExported === true) rows.push(['Exported', 'true']);
    if (props.localCount !== undefined) rows.push(['Locals', String(props.localCount)]);

    // Count true boolean flags
    const trueFlags = Object.entries(props)
      .filter(([k, v]) => v === true && k !== 'isExported')
      .map(([k]) => k.replace(/^sym/, ''));
    if (trueFlags.length > 0) {
      rows.push(['Flags', trueFlags.slice(0, 4).join(', ') + (trueFlags.length > 4 ? ` +${trueFlags.length - 4}` : '')]);
    }
  }

  return (
    <div id="ast-graph-detail" style={{ display: 'block' }}>
      <span className="agd-close" onClick={onClose}>&times;</span>
      <div className="agd-title">{label}</div>
      {rows.map(([key, val], i) => (
        <div key={i} className="agd-row">
          <span className="agd-key">{key}</span>
          <span className="agd-val">{val}</span>
        </div>
      ))}
      <div className="agd-hint">
        Double-click to {node._hasChildren ? (node._isCollapsed ? 'expand' : 'collapse') : 'inspect'}
      </div>
    </div>
  );
}
