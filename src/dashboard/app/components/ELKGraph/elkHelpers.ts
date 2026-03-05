import type { ASTNode } from '../../types';
import { astKindColor } from '../../utils/helpers';

export interface ELKNodeData {
  id: string;
  width: number;
  height: number;
  labels: { text: string }[];
  _astNode: ASTNode;
  _color: string;
  _hasChildren: boolean;
  _isCollapsed: boolean;
  _childCount: number;
}

/** Assign stable path-based IDs to AST nodes. */
export function assignASTIds(node: ASTNode, prefix: string): void {
  (node as any)._elkId = prefix;
  if (node.children) {
    node.children.forEach((child, i) => {
      assignASTIds(child, prefix + '-' + i);
    });
  }
}

export function getElkId(node: ASTNode): string {
  return (node as any)._elkId ?? '';
}

export function countDescendants(node: ASTNode): number {
  if (!node.children || node.children.length === 0) return 0;
  let count = node.children.length;
  node.children.forEach(c => { count += countDescendants(c); });
  return count;
}

export function countVisibleNodes(node: ASTNode, collapsedSet: Set<string>): number {
  let count = 1;
  if (!collapsedSet.has(getElkId(node)) && node.children) {
    node.children.forEach(c => { count += countVisibleNodes(c, collapsedSet); });
  }
  return count;
}

function isExpressionKind(kind: string): boolean {
  return /Expression|Token|Identifier|Keyword|Literal/.test(kind);
}

function isStructuralKind(kind: string): boolean {
  return /SourceFile|Declaration|Statement|Block|VariableDeclarationList|ModuleBlock/.test(kind);
}

export function buildELKGraph(node: ASTNode, collapsedSet: Set<string>, direction: string) {
  const elkNodes: ELKNodeData[] = [];
  const elkEdges: { id: string; sources: string[]; targets: string[] }[] = [];

  function walk(astNode: ASTNode, parentElkId: string | null) {
    const id = getElkId(astNode);
    const label = astNode.name ? astNode.kind + ': ' + astNode.name : astNode.kind;
    const width = Math.min(Math.max(label.length * 7.2 + 28, 90), 280);
    const childCount = countDescendants(astNode);
    const isCollapsed = collapsedSet.has(id);

    elkNodes.push({
      id,
      width,
      height: 32,
      labels: [{ text: label }],
      _astNode: astNode,
      _color: astKindColor(astNode.kind),
      _hasChildren: !!(astNode.children && astNode.children.length > 0),
      _isCollapsed: isCollapsed,
      _childCount: childCount,
    });

    if (parentElkId) {
      elkEdges.push({
        id: 'e-' + parentElkId + '-' + id,
        sources: [parentElkId],
        targets: [id],
      });
    }

    if (!isCollapsed && astNode.children) {
      astNode.children.forEach(child => walk(child, id));
    }
  }

  walk(node, null);

  return {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.spacing.nodeNode': '10',
      'elk.layered.spacing.nodeNodeBetweenLayers': '50',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    },
    children: elkNodes,
    edges: elkEdges,
  };
}

/** Smart collapse: collapse Expression subtrees + deep structural nodes. */
export function computeSmartCollapse(ast: ASTNode): Set<string> {
  const collapsed = new Set<string>();

  function walk(node: ASTNode, depth: number) {
    const hasChildren = node.children && node.children.length > 0;
    if (!hasChildren) return;
    const childCount = countDescendants(node);
    if (depth >= 2 && isExpressionKind(node.kind) && childCount > 2) {
      collapsed.add(getElkId(node));
      return;
    }
    if (depth >= 4 && hasChildren) {
      collapsed.add(getElkId(node));
      return;
    }
    if (depth >= 3 && childCount > 8) {
      collapsed.add(getElkId(node));
      return;
    }
    node.children.forEach(c => walk(c, depth + 1));
  }

  walk(ast, 0);
  return collapsed;
}

/** Outline mode: show only structural skeleton. */
export function computeOutlineCollapse(ast: ASTNode): Set<string> {
  const collapsed = new Set<string>();
  function walk(node: ASTNode) {
    if (!node.children || node.children.length === 0) return;
    if (!isStructuralKind(node.kind)) {
      collapsed.add(getElkId(node));
      return;
    }
    node.children.forEach(c => walk(c));
  }
  walk(ast);
  return collapsed;
}

/** Collapse at depth >= maxDepth. */
export function computeDepthCollapse(ast: ASTNode, maxDepth: number): Set<string> {
  const collapsed = new Set<string>();
  function walk(node: ASTNode, depth: number) {
    if (depth >= maxDepth && node.children && node.children.length > 0) {
      collapsed.add(getElkId(node));
    }
    if (node.children) node.children.forEach(c => walk(c, depth + 1));
  }
  walk(ast, 0);
  return collapsed;
}
