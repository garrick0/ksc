/**
 * Grammar tree operations — traversal, construction, and serialization.
 *
 * All functions take fieldDefs/nodes as input. No module-level state,
 * no imports from specs/. Reusable for any grammar (TS AST, mock, future).
 */

import type { ASTNode, FieldDef } from './ports.js';
import type { KSCommentRange } from './base-types.js';

/** ASTNode with index signature for dynamic field access by FieldDef name. */
type IndexedNode = ASTNode & { readonly [key: string]: unknown };

// ═══════════════════════════════════════════════════════════════════════
// Child traversal
// ═══════════════════════════════════════════════════════════════════════

/**
 * Collect child nodes in declaration order using precomputed fieldDefs.
 */
export function getChildren(
  node: ASTNode,
  fieldDefs: Readonly<Record<string, readonly FieldDef[]>>,
): ASTNode[] {
  const defs = fieldDefs[node.kind];
  if (!defs) return [];
  const result: ASTNode[] = [];
  for (const f of defs) {
    if (f.tag === 'prop') continue;
    const v = (node as IndexedNode)[f.name];
    if (v == null) continue;
    if (Array.isArray(v)) {
      for (const item of v) if (item != null) result.push(item as ASTNode);
    } else {
      result.push(v as ASTNode);
    }
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════
// Node builder
// ═══════════════════════════════════════════════════════════════════════

/**
 * Generic node builder: creates any node kind with the given fields.
 */
export function createNode(
  kind: string,
  fields: Record<string, unknown> | undefined,
  fieldDefs: Readonly<Record<string, readonly FieldDef[]>>,
): ASTNode {
  const defs = fieldDefs[kind];
  const children: ASTNode[] = [];
  const node = { kind, pos: 0, end: 0, text: '', children } as ASTNode & Record<string, unknown>;
  if (defs) {
    const f$ = (fields ?? {}) as Record<string, unknown>;
    for (const f of defs) {
      switch (f.tag) {
        case 'child':
          node[f.name] = f$[f.name];
          if (f$[f.name]) children.push(f$[f.name] as ASTNode);
          break;
        case 'optChild':
          node[f.name] = f$[f.name];
          if (f$[f.name]) children.push(f$[f.name] as ASTNode);
          break;
        case 'list': {
          const items = (f$[f.name] as ASTNode[]) ?? [];
          node[f.name] = items;
          for (const item of items) if (item) children.push(item);
          break;
        }
        case 'prop':
          node[f.name] = f$[f.name] ?? f.default;
          break;
      }
    }
  }
  return node;
}

// ═══════════════════════════════════════════════════════════════════════
// Serialization
// ═══════════════════════════════════════════════════════════════════════

/** JSON-safe representation of a KS node. */
export interface JSONNode {
  kind: string;
  pos: number;
  end: number;
  text?: string;
  children?: JSONNode[];
  leadingComments?: KSCommentRange[];
  trailingComments?: KSCommentRange[];
  [key: string]: unknown;
}

/** JSON-safe KSTree representation. */
export interface JSONTree {
  root: JSONNode;
}

// Nodes with only prop fields — precomputed per grammar
function computePropsOnly(fieldDefs: Readonly<Record<string, readonly FieldDef[]>>): ReadonlySet<string> {
  return new Set(
    Object.entries(fieldDefs)
      .filter(([, defs]) => defs.length > 0 && defs.every(f => f.tag === 'prop'))
      .map(([k]) => k),
  );
}

/** Serialize a single node to a JSON-safe plain object. */
export function nodeToJSON(
  node: ASTNode,
  fieldDefs: Readonly<Record<string, readonly FieldDef[]>>,
  propsOnly?: ReadonlySet<string>,
): JSONNode {
  const po = propsOnly ?? computePropsOnly(fieldDefs);
  const result: JSONNode = { kind: node.kind, pos: node.pos, end: node.end };
  if (node.text) result.text = node.text;
  const kn = node as IndexedNode;
  if (kn.leadingComments) result.leadingComments = kn.leadingComments as KSCommentRange[];
  if (kn.trailingComments) result.trailingComments = kn.trailingComments as KSCommentRange[];
  const defs = fieldDefs[node.kind];
  if (defs) {
    for (const f of defs) {
      const val = kn[f.name];
      switch (f.tag) {
        case 'child': result[f.name] = nodeToJSON(val as ASTNode, fieldDefs, po); break;
        case 'optChild': if (val != null) result[f.name] = nodeToJSON(val as ASTNode, fieldDefs, po); break;
        case 'list': if (val && (val as ASTNode[]).length > 0) result[f.name] = (val as ASTNode[]).map((v: ASTNode) => nodeToJSON(v, fieldDefs, po)); break;
        case 'prop': if (val !== undefined && val !== '' && val !== false) result[f.name] = val; break;
      }
    }
  }
  if (po.has(node.kind) && node.children.length > 0) {
    result.children = node.children.map(c => nodeToJSON(c, fieldDefs, po));
  }
  return result;
}

/** Deserialize a JSON object back to a node with typed fields + children. */
export function nodeFromJSON(
  data: JSONNode,
  fieldDefs: Readonly<Record<string, readonly FieldDef[]>>,
): ASTNode {
  const children: ASTNode[] = [];
  const node = {
    kind: data.kind,
    pos: data.pos ?? 0,
    end: data.end ?? 0,
    text: data.text ?? '',
  } as ASTNode & Record<string, unknown>;
  if (data.leadingComments) node.leadingComments = data.leadingComments;
  if (data.trailingComments) node.trailingComments = data.trailingComments;
  const defs = fieldDefs[data.kind];
  if (defs) {
    for (const f of defs) {
      switch (f.tag) {
        case 'child': {
          const child = nodeFromJSON(data[f.name] as JSONNode, fieldDefs);
          node[f.name] = child;
          children.push(child);
          break;
        }
        case 'optChild': {
          if (data[f.name] != null) {
            const child = nodeFromJSON(data[f.name] as JSONNode, fieldDefs);
            node[f.name] = child;
            children.push(child);
          } else {
            node[f.name] = undefined;
          }
          break;
        }
        case 'list': {
          const arr = data[f.name] as JSONNode[] | undefined;
          if (arr && arr.length > 0) {
            const items = arr.map(a => nodeFromJSON(a, fieldDefs));
            node[f.name] = items;
            children.push(...items);
          } else {
            node[f.name] = [];
          }
          break;
        }
        case 'prop': {
          node[f.name] = data[f.name] ?? f.default;
          break;
        }
      }
    }
  }
  if (children.length === 0 && data.children && data.children.length > 0) {
    children.push(...data.children.map(c => nodeFromJSON(c, fieldDefs)));
  }
  node.children = children;
  return node;
}

/** Serialize a tree to JSON. */
export function treeToJSON(
  tree: { root: ASTNode },
  fieldDefs: Readonly<Record<string, readonly FieldDef[]>>,
): JSONTree {
  return { root: nodeToJSON(tree.root, fieldDefs) };
}

/** Deserialize a JSON tree. */
export function treeFromJSON(
  data: JSONTree,
  fieldDefs: Readonly<Record<string, readonly FieldDef[]>>,
): { root: ASTNode } {
  return { root: nodeFromJSON(data.root, fieldDefs) };
}
