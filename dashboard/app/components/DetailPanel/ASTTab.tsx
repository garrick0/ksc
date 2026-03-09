import { useState, useCallback } from 'react';
import { astKindColor } from '../../utils/helpers';
import type { ASTNode, ASTSchemaInfo } from '../../types';

interface Props {
  astNode: ASTNode;
  source?: string;
  schema?: ASTSchemaInfo;
  analysisDepth?: string;
}

interface Selection {
  node: ASTNode;
  path: ASTNode[];
}

export function ASTTab({ astNode, source, schema, analysisDepth }: Props) {
  const [selection, setSelection] = useState<Selection | null>(null);

  const handleSelect = useCallback((node: ASTNode, path: ASTNode[]) => {
    setSelection({ node, path });
  }, []);

  const handleNavigate = useCallback((node: ASTNode) => {
    const path = findPath(astNode, node);
    if (path) setSelection({ node, path });
  }, [astNode]);

  return (
    <div className="ast-tab-split">
      <div className="ast-tab-tree">
        <ASTNodeView
          node={astNode}
          depth={0}
          path={[]}
          selectedNode={selection?.node ?? null}
          onSelect={handleSelect}
        />
      </div>
      {selection && (
        <NodeInspector
          node={selection.node}
          path={selection.path}
          source={source}
          schema={schema}
          analysisDepth={analysisDepth}
          onNavigate={handleNavigate}
          onClose={() => setSelection(null)}
        />
      )}
    </div>
  );
}

// ── Tree Node View ──

interface NodeViewProps {
  node: ASTNode;
  depth: number;
  path: ASTNode[];
  selectedNode: ASTNode | null;
  onSelect: (node: ASTNode, path: ASTNode[]) => void;
}

function ASTNodeView({ node, depth, path, selectedNode, onSelect }: NodeViewProps) {
  const hasChildren = node.children && node.children.length > 0;
  const [collapsed, setCollapsed] = useState(depth >= 2);
  const isSelected = node === selectedNode;
  const currentPath = [...path, node];

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) setCollapsed(c => !c);
  }, [hasChildren]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(node, currentPath);
  }, [node, onSelect, currentPath]);

  // Count props for inline badge
  const propCount = node.props ? Object.keys(node.props).length : 0;
  const hasBoolTrue = node.props && Object.values(node.props).some(v => v === true);

  return (
    <div className={depth === 0 ? 'ast-node root' : 'ast-node'}>
      <div
        className={`ast-header${isSelected ? ' ast-selected' : ''}`}
        onClick={handleClick}
      >
        <span className="ast-toggle" onClick={handleToggle}>
          {hasChildren ? (collapsed ? '\u25B8' : '\u25BE') : ' '}
        </span>
        <span className="ast-dot" style={{ background: astKindColor(node.kind) }} />
        <span className="ast-kind">{node.kind}</span>
        {node.name && <span className="ast-name">{node.name}</span>}
        {propCount > 0 && (
          <span className={`ast-prop-badge${hasBoolTrue ? ' has-true' : ''}`}>
            {propCount}
          </span>
        )}
        {!hasChildren && node.text && node.text !== node.name && (
          <span className="ast-text">{node.text}</span>
        )}
      </div>

      {hasChildren && !collapsed && (
        <div className="ast-children">
          {node.children.map((child, i) => (
            <ASTNodeView
              key={i}
              node={child}
              depth={depth + 1}
              path={currentPath}
              selectedNode={selectedNode}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Node Inspector Panel ──

interface InspectorProps {
  node: ASTNode;
  path: ASTNode[];
  source?: string;
  schema?: ASTSchemaInfo;
  analysisDepth?: string;
  onNavigate: (node: ASTNode) => void;
  onClose: () => void;
}

interface PropDef {
  name: string;
  tag: string;
  typeRef?: string;
}

function categorizeProps(propDefs: PropDef[]): {
  identity: PropDef[];
  flags: PropDef[];
  symFlags: PropDef[];
  types: PropDef[];
  imports: PropDef[];
  other: PropDef[];
} {
  const identity: PropDef[] = [];
  const flags: PropDef[] = [];
  const symFlags: PropDef[] = [];
  const types: PropDef[] = [];
  const imports: PropDef[] = [];
  const other: PropDef[] = [];

  for (const d of propDefs) {
    if (d.name === 'escapedText' || d.name === 'value') {
      identity.push(d);
    } else if (d.name.startsWith('sym')) {
      symFlags.push(d);
    } else if (d.name === 'typeString') {
      types.push(d);
    } else if (
      d.name === 'resolvedFileName' ||
      d.name === 'resolvedModulePath' ||
      d.name === 'importModuleSpecifier' ||
      d.name === 'resolvesToImport'
    ) {
      imports.push(d);
    } else if (d.typeRef === 'boolean') {
      flags.push(d);
    } else {
      other.push(d);
    }
  }

  return { identity, flags, symFlags, types, imports, other };
}

function NodeInspector({ node, path, source, schema, analysisDepth, onNavigate, onClose }: InspectorProps) {
  const sumTypes = schema?.sumTypes[node.kind];
  const allFieldDefs = schema?.fieldDefs[node.kind];
  const propDefs = allFieldDefs?.filter(d => d.tag === 'prop') ?? [];
  const childFieldDefs = allFieldDefs?.filter(d => d.tag !== 'prop') ?? [];
  const categories = categorizeProps(propDefs as PropDef[]);
  const [symCollapsed, setSymCollapsed] = useState(false);

  const getVal = (name: string): string | number | boolean | undefined => {
    return node.props?.[name];
  };

  return (
    <div className="ast-inspector">
      <div className="ast-insp-header">
        <span className="ast-insp-title">Inspector</span>
        <span className="ast-insp-close" onClick={onClose}>&times;</span>
      </div>

      {/* Breadcrumb */}
      <div className="ast-insp-breadcrumb">
        {path.map((n, i) => (
          <span key={i}>
            {i > 0 && <span className="ast-bc-sep">&rsaquo;</span>}
            <span
              className={`ast-bc-item${n === node ? ' active' : ''}`}
              onClick={() => n !== node && onNavigate(n)}
            >
              {n.name || n.kind}
            </span>
          </span>
        ))}
      </div>

      {/* Kind + Name */}
      <div className="ast-insp-section">
        <div className="ast-insp-kind-row">
          <span className="ast-insp-dot" style={{ background: astKindColor(node.kind) }} />
          <span className="ast-insp-kind">{node.kind}</span>
          {node.name && <span className="ast-insp-name">{node.name}</span>}
        </div>

        {sumTypes && sumTypes.length > 0 && (
          <div className="ast-insp-sumtypes">
            {sumTypes.map(st => (
              <span key={st} className="ast-insp-sumtype">{st}</span>
            ))}
          </div>
        )}
      </div>

      {/* Position & Identity */}
      <div className="ast-insp-section">
        <div className="ast-insp-label">Position</div>
        <div className="ast-insp-props">
          <div className="ast-insp-prop">
            <span className="ast-insp-pk">pos</span>
            <span className="ast-insp-pv">{node.pos}</span>
          </div>
          <div className="ast-insp-prop">
            <span className="ast-insp-pk">end</span>
            <span className="ast-insp-pv">{node.end}</span>
          </div>
          <div className="ast-insp-prop">
            <span className="ast-insp-pk">text</span>
            <span className="ast-insp-pv ast-insp-mono">
              {node.text.length > 50 ? node.text.slice(0, 47) + '...' : node.text}
            </span>
          </div>
          {categories.identity.map(d => {
            const val = getVal(d.name);
            return val !== undefined && val !== '' ? (
              <div className="ast-insp-prop" key={d.name}>
                <span className="ast-insp-pk">{d.name}</span>
                <span className="ast-insp-pv ast-insp-mono">{String(val)}</span>
              </div>
            ) : null;
          })}
        </div>
      </div>

      {/* Type String */}
      {categories.types.length > 0 && (
        <div className="ast-insp-section">
          <div className="ast-insp-label">Type</div>
          {categories.types.map(d => {
            const val = getVal(d.name);
            return (
              <div key={d.name} className="ast-insp-type-row">
                {val ? (
                  <span className="ast-insp-typestr">{String(val)}</span>
                ) : (
                  <span className="ast-insp-typestr absent">
                    {analysisDepth === 'parse' ? 'requires check depth' : 'none'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Boolean Flags (non-sym) */}
      {categories.flags.length > 0 && (
        <div className="ast-insp-section">
          <div className="ast-insp-label">Flags</div>
          <div className="ast-insp-flags">
            {categories.flags.map(d => {
              const val = getVal(d.name);
              const isTrue = val === true;
              const isAbsent = val === undefined;
              return (
                <div key={d.name} className={`ast-insp-flag${isAbsent ? ' absent' : ''}`}>
                  <span className={`ast-flag-indicator${isTrue ? ' true' : ' false'}`}>
                    {isTrue ? '\u2713' : '\u2717'}
                  </span>
                  <span className="ast-flag-name">{d.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Symbol Flags (sym*) */}
      {categories.symFlags.length > 0 && (
        <div className="ast-insp-section">
          <div className="ast-insp-label ast-insp-label-toggle" onClick={() => setSymCollapsed(c => !c)}>
            <span>Symbol Flags ({categories.symFlags.filter(d => getVal(d.name) === true).length}/{categories.symFlags.length})</span>
            <span className="ast-toggle-chevron">{symCollapsed ? '\u25B8' : '\u25BE'}</span>
          </div>
          {!symCollapsed && (
            <div className="ast-insp-flags">
              {categories.symFlags.map(d => {
                const val = getVal(d.name);
                const isTrue = val === true;
                const isAbsent = val === undefined;
                const shortName = d.name.replace(/^sym/, '');
                return (
                  <div key={d.name} className={`ast-insp-flag${isAbsent ? ' absent' : ''}`}>
                    <span className={`ast-flag-indicator${isTrue ? ' true' : ' false'}`}>
                      {isTrue ? '\u2713' : '\u2717'}
                    </span>
                    <span className="ast-flag-name">{shortName}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Import Info */}
      {categories.imports.length > 0 && categories.imports.some(d => getVal(d.name) !== undefined) && (
        <div className="ast-insp-section">
          <div className="ast-insp-label">Imports</div>
          <div className="ast-insp-props">
            {categories.imports.map(d => {
              const val = getVal(d.name);
              if (val === undefined) return null;
              if (d.typeRef === 'boolean') {
                return (
                  <div key={d.name} className="ast-insp-flag">
                    <span className={`ast-flag-indicator${val === true ? ' true' : ' false'}`}>
                      {val === true ? '\u2713' : '\u2717'}
                    </span>
                    <span className="ast-flag-name">{d.name}</span>
                  </div>
                );
              }
              return (
                <div key={d.name} className="ast-insp-prop">
                  <span className="ast-insp-pk">{d.name}</span>
                  <span className="ast-insp-pv ast-insp-mono">{String(val)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Other Props */}
      {categories.other.length > 0 && categories.other.some(d => getVal(d.name) !== undefined) && (
        <div className="ast-insp-section">
          <div className="ast-insp-label">Properties</div>
          <div className="ast-insp-props">
            {categories.other.map(d => {
              const val = getVal(d.name);
              if (val === undefined) return null;
              return (
                <div key={d.name} className="ast-insp-prop">
                  <span className="ast-insp-pk">{d.name}</span>
                  <span className="ast-insp-pv ast-insp-mono">{String(val)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Props not in schema (fallback) */}
      {node.props && propDefs.length === 0 && (
        <div className="ast-insp-section">
          <div className="ast-insp-label">Properties</div>
          <div className="ast-insp-props">
            {Object.entries(node.props).map(([key, val]) => (
              <div className="ast-insp-prop" key={key}>
                <span className="ast-insp-pk">{key}</span>
                <span className="ast-insp-pv ast-insp-mono">{String(val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Named Fields */}
      {node.fields && node.fields.length > 0 && (
        <div className="ast-insp-section">
          <div className="ast-insp-label">Fields</div>
          <div className="ast-insp-fields">
            {node.fields.map((field, i) => {
              const def = childFieldDefs?.find(d => d.name === field.name);
              const children = field.indices.map(idx => node.children[idx]);
              return (
                <FieldRow
                  key={i}
                  fieldName={field.name}
                  tag={def?.tag}
                  typeRef={def?.typeRef}
                  children={children}
                  onNavigate={onNavigate}
                />
              );
            })}
            {/* Show absent optional fields from schema */}
            {childFieldDefs && childFieldDefs
              .filter(d => d.tag === 'optChild' && !node.fields!.some(f => f.name === d.name))
              .map(d => (
                <div key={d.name} className="ast-insp-field absent">
                  <span className="ast-insp-fname">{d.name}</span>
                  <span className="ast-insp-ftag">{d.tag}</span>
                  <span className="ast-insp-fval absent">absent</span>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* Children (when no named fields) */}
      {(!node.fields || node.fields.length === 0) && node.children.length > 0 && (
        <div className="ast-insp-section">
          <div className="ast-insp-label">Children ({node.children.length})</div>
          <div className="ast-insp-fields">
            {node.children.map((child, i) => (
              <div
                key={i}
                className="ast-insp-field clickable"
                onClick={() => onNavigate(child)}
              >
                <span className="ast-insp-dot-sm" style={{ background: astKindColor(child.kind) }} />
                <span className="ast-insp-fval">{child.kind}</span>
                {child.name && <span className="ast-insp-child-name">{child.name}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Source snippet */}
      {source && (
        <SourceSnippet source={source} pos={node.pos} end={node.end} />
      )}
    </div>
  );
}

// ── Field Row ──

interface FieldRowProps {
  fieldName: string;
  tag?: string;
  typeRef?: string;
  children: ASTNode[];
  onNavigate: (node: ASTNode) => void;
}

function FieldRow({ fieldName, tag, typeRef, children, onNavigate }: FieldRowProps) {
  if (children.length === 1) {
    const child = children[0];
    return (
      <div className="ast-insp-field clickable" onClick={() => onNavigate(child)}>
        <span className="ast-insp-fname">{fieldName}</span>
        {tag && <span className="ast-insp-ftag">{tag}</span>}
        <span className="ast-insp-dot-sm" style={{ background: astKindColor(child.kind) }} />
        <span className="ast-insp-fval">{child.kind}</span>
        {child.name && <span className="ast-insp-child-name">{child.name}</span>}
        {typeRef && <span className="ast-insp-typeref">{typeRef}</span>}
      </div>
    );
  }

  return (
    <div className="ast-insp-field-group">
      <div className="ast-insp-field-header">
        <span className="ast-insp-fname">{fieldName}</span>
        {tag && <span className="ast-insp-ftag">{tag}</span>}
        <span className="ast-insp-count">[{children.length}]</span>
        {typeRef && <span className="ast-insp-typeref">{typeRef}</span>}
      </div>
      {children.map((child, i) => (
        <div
          key={i}
          className="ast-insp-field clickable ast-insp-field-item"
          onClick={() => onNavigate(child)}
        >
          <span className="ast-insp-dot-sm" style={{ background: astKindColor(child.kind) }} />
          <span className="ast-insp-fval">{child.kind}</span>
          {child.name && <span className="ast-insp-child-name">{child.name}</span>}
        </div>
      ))}
    </div>
  );
}

// ── Source Snippet ──

function SourceSnippet({ source, pos, end }: { source: string; pos: number; end: number }) {
  const lines = source.split('\n');
  let charIdx = 0;
  let startLine = 0, endLine = lines.length - 1;
  for (let i = 0; i < lines.length; i++) {
    const lineEnd = charIdx + lines[i].length + 1;
    if (charIdx <= pos && pos < lineEnd) startLine = i;
    if (charIdx < end && end <= lineEnd) { endLine = i; break; }
    charIdx = lineEnd;
  }

  const contextBefore = 1;
  const contextAfter = 1;
  const fromLine = Math.max(0, startLine - contextBefore);
  const toLine = Math.min(lines.length - 1, endLine + contextAfter);

  let offset = 0;
  for (let i = 0; i < fromLine; i++) offset += lines[i].length + 1;

  const displayLines = lines.slice(fromLine, toLine + 1);

  return (
    <div className="ast-insp-section">
      <div className="ast-insp-label">Source</div>
      <div className="ast-insp-source">
        {displayLines.map((line, i) => {
          const lineStart = offset;
          const lineEnd = offset + line.length;
          offset = lineEnd + 1;
          const lineNum = fromLine + i + 1;

          const hlStart = Math.max(pos, lineStart) - lineStart;
          const hlEnd = Math.min(end, lineEnd) - lineStart;
          const isHighlighted = lineStart < end && lineEnd > pos;

          return (
            <div key={i} className={`ast-src-line${isHighlighted ? ' highlighted' : ''}`}>
              <span className="ast-src-ln">{lineNum}</span>
              <span className="ast-src-code">
                {isHighlighted && hlStart > 0 && (
                  <span>{line.slice(0, hlStart)}</span>
                )}
                {isHighlighted && (
                  <span className="ast-src-hl">{line.slice(Math.max(0, hlStart), hlEnd)}</span>
                )}
                {isHighlighted && hlEnd < line.length && (
                  <span>{line.slice(hlEnd)}</span>
                )}
                {!isHighlighted && line}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Helpers ──

function findPath(root: ASTNode, target: ASTNode): ASTNode[] | null {
  if (root === target) return [root];
  for (const child of root.children) {
    const path = findPath(child, target);
    if (path) return [root, ...path];
  }
  return null;
}
