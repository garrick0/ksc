/**
 * Tree serialization and deserialization for attributed grammars.
 *
 * serializeTree: produces a JSON-safe copy of a stamped/attributed tree.
 *   Strips circular navigation props ($parent, $prev, $next).
 *   Optionally includes computed AG attribute values.
 *
 * deserializeTree: reconstructs a tree from serialized data and stamps
 *   navigation properties. Ready for applyAttributes().
 *
 * Note: Deserialized trees have no back-references to the original host
 * (e.g., tsNode for KSC trees). AG specs that access host-specific
 * properties will not work on deserialized trees.
 */

import { stampTree } from './interpret.js';

// ── Types ──

export interface SerializeOptions {
  /** Include computed AG attributes in output? Default: false */
  includeAttributes?: boolean;
  /** Attribute names to include (if includeAttributes=true). Default: all */
  attributeFilter?: string[];
  /** Property keys to always exclude from serialization. */
  excludeKeys?: string[];
  /**
   * The property key that holds children on each node (e.g., 'children', 'kids').
   * Serialized output always uses 'children' as the key.
   * Default: 'children'
   */
  childrenKey?: string;
}

/** The set of navigation properties stamped by stampTree. */
const NAV_KEYS = new Set(['$parent', '$children', '$index', '$root', '$prev', '$next', '$agAttrs']);

// ── Serialize ──

/**
 * Serialize a stamped tree to a JSON-safe plain object.
 *
 * Strips $parent, $prev, $next (circular refs).
 * Keeps $children, $index, $root only if includeAttributes is true.
 * Always preserves the tree structure via getChildren.
 */
export function serializeTree<N extends object>(
  root: N,
  getChildren: (node: N) => N[],
  options?: SerializeOptions,
): unknown {
  const includeAttrs = options?.includeAttributes ?? false;
  const attrFilter = options?.attributeFilter ? new Set(options.attributeFilter) : undefined;
  const excludeKeys = new Set(options?.excludeKeys ?? []);
  const childrenKey = options?.childrenKey ?? 'children';

  function serializeNode(node: N): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const agAttrs: Set<string> | undefined = (node as any).$agAttrs;

    // Always serialize tree children as 'children' from getChildren()
    result.children = getChildren(node).map(child => serializeNode(child));

    // Collect all own enumerable properties
    for (const key of Object.keys(node)) {
      // Skip the children key — already handled above
      if (key === childrenKey || key === 'children') continue;
      // Always skip circular navigation
      if (NAV_KEYS.has(key)) continue;
      // Skip user-excluded keys
      if (excludeKeys.has(key)) continue;

      // If not including attributes, skip AG-computed properties
      if (!includeAttrs && agAttrs?.has(key)) continue;

      const value = (node as Record<string, unknown>)[key];

      // Skip functions (like defLookup)
      if (typeof value === 'function') continue;

      // Serialize the value
      result[key] = serializeValue(value, getChildren, includeAttrs, attrFilter, excludeKeys);
    }

    // If including attributes, force-access lazy getters for filtered attributes
    if (includeAttrs && attrFilter) {
      for (const attrName of attrFilter) {
        if (result[attrName] !== undefined) continue;
        if (!agAttrs?.has(attrName)) continue;
        const value = (node as Record<string, unknown>)[attrName];
        if (typeof value !== 'function') {
          result[attrName] = serializeValue(value, getChildren, false, undefined, excludeKeys);
        }
      }
    }

    return result;
  }

  return serializeNode(root);
}

function serializeValue<N extends object>(
  value: unknown,
  getChildren: (node: N) => N[],
  includeAttrs: boolean,
  attrFilter: Set<string> | undefined,
  excludeKeys: Set<string>,
): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Set) return [...value];
  if (value instanceof Map) return Object.fromEntries(value);
  if (Array.isArray(value)) return value.map(v => serializeValue(v, getChildren, includeAttrs, attrFilter, excludeKeys));
  if (typeof value === 'object') {
    // Shallow serialize plain objects (e.g., KindDefinition in attributes)
    const obj: Record<string, unknown> = {};
    const nestedAgAttrs: Set<string> | undefined = (value as any).$agAttrs;
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === 'function') continue;
      if (NAV_KEYS.has(k)) continue;
      if (excludeKeys.has(k)) continue;
      if (nestedAgAttrs?.has(k)) continue;
      obj[k] = typeof v === 'object' && v !== null ? serializeValue(v, getChildren, false, undefined, excludeKeys) : v;
    }
    return obj;
  }
  return undefined;
}

// ── Deserialize ──

/**
 * Deserialize a tree from a plain object and stamp navigation.
 * Returns the root node, ready for stampTree + applyAttributes.
 *
 * The getChildren function is used to stamp navigation.
 * Typically: `(node) => node.children ?? []`
 */
export function deserializeTree<N extends object>(
  data: unknown,
  getChildren: (node: N) => N[],
): N {
  const root = data as N;
  stampTree(root, getChildren);
  return root;
}
