import type { ASTDashboardData, ASTNode } from '../../types';
import { shortFileName, astKindColor } from '../../utils/helpers';

export interface TreeNodeData {
  name: string;
  id?: string;
  color: string;
  strokeColor?: string;
  badge?: string | null;
  badgeColor?: string;
  countText?: string;
  _isGroup?: boolean;
  _isFile?: boolean;
  _isDir?: boolean;
  tooltip?: { title: string; rows: [string, string][]; props?: string[] };
  action?: { type: string; payload: unknown };
  propChips?: { label: string; length: number; color: string }[];
  children?: TreeNodeData[];
}

/** Build a tree: Program -> Files -> top-level AST nodes. */
export function buildASTTree(data: ASTDashboardData): TreeNodeData {
  return {
    name: 'Program',
    _isGroup: true,
    color: 'var(--parse-color)',
    tooltip: { title: 'Program', rows: [['Files', data.files.length + '']] },
    children: data.files.map(f => ({
      name: shortFileName(f.fileName),
      _isFile: true,
      color: 'var(--parse-color)',
      badge: null,
      countText: `(${f.lineCount} lines)`,
      tooltip: { title: f.fileName, rows: [['Lines', f.lineCount + '']] },
      action: { type: 'SELECT_FILE', payload: { fileName: f.fileName } },
      children: f.ast.children.map((node, i) => buildASTNodeTree(node, `${f.fileName}:${i}`)),
    })),
  };
}

function buildASTNodeTree(node: ASTNode, prefix: string): TreeNodeData {
  const hasChildren = node.children && node.children.length > 0;
  return {
    id: prefix,
    name: node.name ? `${node.kind}: ${node.name}` : node.kind,
    color: astKindColor(node.kind),
    badge: null,
    tooltip: {
      title: node.kind,
      rows: [
        ...(node.name ? [['Name', node.name] as [string, string]] : []),
        ['Position', `${node.pos} \u2014 ${node.end}`],
        ...(node.text ? [['Text', node.text.slice(0, 80)] as [string, string]] : []),
      ],
    },
    action: { type: 'OPEN_DETAIL', payload: { detailType: 'fileViewer', payload: { fileName: prefix.split(':')[0] } } },
    children: hasChildren
      ? node.children.map((child, i) => buildASTNodeTree(child, `${prefix}-${i}`))
      : [],
  };
}
