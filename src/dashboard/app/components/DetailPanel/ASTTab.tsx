import { useState, useCallback } from 'react';
import { astKindColor } from '../../utils/helpers';
import type { ASTNode } from '../../types';

const AG_ATTR_KEYS = ['kindDefs', 'kindAnnotations', 'valueImports', 'localBindings', 'importViolation', 'allViolations'];

interface Props {
  astNode: ASTNode;
  isKSMode: boolean;
}

export function ASTTab({ astNode, isKSMode }: Props) {
  return (
    <div className="ast-wrap">
      <ASTNodeView node={astNode} depth={0} isKSMode={isKSMode} />
    </div>
  );
}

function ASTNodeView({ node, depth, isKSMode }: { node: ASTNode; depth: number; isKSMode: boolean }) {
  const hasChildren = node.children && node.children.length > 0;
  const [collapsed, setCollapsed] = useState(depth >= 2);
  const [detailOpen, setDetailOpen] = useState(false);

  const attrs = isKSMode ? getNodeAttributes(node) : [];

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if ((e.target as HTMLElement).classList.contains('ast-attr-badge')) {
      setDetailOpen(d => !d);
      return;
    }
    if (hasChildren) setCollapsed(c => !c);
    else if (attrs.length > 0) setDetailOpen(d => !d);
  }, [hasChildren, attrs.length]);

  return (
    <div className={depth === 0 ? 'ast-node root' : 'ast-node'}>
      <div className="ast-header" onClick={handleClick}>
        <span className="ast-toggle">
          {hasChildren ? (collapsed ? '\u25B8' : '\u25BE') : ' '}
        </span>
        <span className="ast-dot" style={{ background: astKindColor(node.kind) }} />
        <span className="ast-kind">{node.kind}</span>
        {node.name && <span className="ast-name">{node.name}</span>}
        {!hasChildren && node.text && node.text !== node.name && (
          <span className="ast-text">{node.text}</span>
        )}
        {attrs.length > 0 && (
          <span className="ast-attr-badges">
            {attrs.map(a => {
              const cls = AG_ATTR_KEYS.includes(a.key) ? `attr-${a.key}` : 'attr-default';
              const label = a.key + (Array.isArray(a.value) ? `(${a.value.length})` : '');
              return (
                <span key={a.key} className={`ast-attr-badge ${cls}`} title={formatAttrValue(a.value)}>
                  {label}
                </span>
              );
            })}
          </span>
        )}
      </div>

      {attrs.length > 0 && detailOpen && (
        <div className="ast-attr-detail open">
          {attrs.map(a => `${a.key}: ${formatAttrValue(a.value)}`).join('\n')}
        </div>
      )}

      {hasChildren && !collapsed && (
        <div className="ast-children">
          {node.children.map((child, i) => (
            <ASTNodeView key={i} node={child} depth={depth + 1} isKSMode={isKSMode} />
          ))}
        </div>
      )}
    </div>
  );
}

function getNodeAttributes(node: any): { key: string; value: unknown }[] {
  const attrs: { key: string; value: unknown }[] = [];
  for (const key of AG_ATTR_KEYS) {
    if (node[key] !== undefined && node[key] !== null) {
      const val = node[key];
      if (Array.isArray(val) && val.length === 0) continue;
      if (typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length === 0) continue;
      attrs.push({ key, value: val });
    }
  }
  return attrs;
}

function formatAttrValue(val: unknown): string {
  if (Array.isArray(val)) {
    return val.map(item => {
      if (typeof item === 'object' && item !== null) {
        const o = item as any;
        if (o.name && o.properties) return o.name + ' {' + Object.keys(o.properties).join(', ') + '}';
        if (o.name) return o.name;
        return JSON.stringify(item);
      }
      return String(item);
    }).join(', ');
  }
  if (typeof val === 'object' && val !== null) return JSON.stringify(val, null, 1);
  return String(val);
}
