/**
 * KS AST serialization — converts KSTree to/from JSON-safe format.
 *
 * Strips AG navigation properties ($parent, $prev, $next, etc.).
 * Preserves all structural fields and scalar properties (name, escapedText,
 * fileName, etc.) — child-reference properties are reconstructable from children.
 *
 * Uses the AG library's generic serializeTree for the heavy lifting.
 */

import type { KSNode, KSProgram } from './ast.js';
import { getChildren } from './ast.js';
import type { KSTree } from './convert.js';
import { serializeTree, deserializeTree, type SerializeOptions } from '../../libs/ag/src/serialize.js';

// ── Types ──

export interface SerializedKSNode {
  kind: string;
  pos: number;
  end: number;
  text: string;
  children: SerializedKSNode[];
  // Scalar properties extracted per-kind:
  name?: string;
  escapedText?: string;
  fileName?: string;
  sourceText?: string;
  isDeclarationFile?: boolean;
  lineStarts?: readonly number[];
  isTypeOnly?: boolean;
  isConst?: boolean;
  isLet?: boolean;
  value?: string | number;
  operatorToken?: string;
  // AG attributes (when includeAttributes is true):
  [key: string]: unknown;
}

export interface SerializedKSTree {
  root: SerializedKSNode;
}

// ── Serialize ──

export interface KSSerializeOptions {
  /** Include computed AG attributes? Default: false */
  includeAttributes?: boolean;
  /** Which attribute names to include. Default: all (if includeAttributes=true) */
  attributeFilter?: string[];
}

/**
 * Serialize a KSTree to a JSON-safe format.
 * Strips AG navigation properties.
 */
export function serializeKSTree(
  ksTree: KSTree,
  options?: KSSerializeOptions,
): SerializedKSTree {
  const agOptions: SerializeOptions = {
    includeAttributes: options?.includeAttributes ?? false,
    attributeFilter: options?.attributeFilter,
    excludeKeys: ['compilationUnits', 'node'],
  };

  const serialized = serializeTree(ksTree.root as unknown as object, getChildren as (n: object) => object[], agOptions);
  return { root: serialized as SerializedKSNode };
}

/**
 * Serialize a single KSNode subtree to JSON-safe format.
 */
export function serializeKSNode(
  node: KSNode,
  options?: KSSerializeOptions,
): SerializedKSNode {
  const agOptions: SerializeOptions = {
    includeAttributes: options?.includeAttributes ?? false,
    attributeFilter: options?.attributeFilter,
    excludeKeys: ['compilationUnits', 'node'],
  };

  return serializeTree(node as unknown as object, getChildren as (n: object) => object[], agOptions) as SerializedKSNode;
}

// ── Deserialize ──

/**
 * Deserialize a KSTree from JSON data.
 * Stamps navigation properties ($parent, $children, etc.).
 * The resulting tree can have AG specs applied to it.
 */
export function deserializeKSTree(data: SerializedKSTree): KSTree {
  const childrenFn = (node: object): object[] => {
    const n = node as { children?: object[]; compilationUnits?: object[] };
    if ((node as any).kind === 'Program' && n.compilationUnits) {
      return n.compilationUnits;
    }
    return n.children ?? [];
  };

  const root = deserializeTree<object>(data.root, childrenFn);
  return { root: root as KSProgram };
}
