/**
 * Node schema registry.
 *
 * Collects NodeDef entries into a schema that provides:
 * - Runtime introspection (all kinds, children structure, etc.)
 * - Derived getChildren function
 * - Completeness checking for production equations
 */

import type { NodeDef, NodeSpec } from './define.js';

// ── Schema type ──────────────────────────────────────────────────────

export interface NodeSchema<N extends object = any> {
  /** All registered node definitions, keyed by kind string. */
  readonly defs: ReadonlyMap<string, NodeDef>;

  /** All kind strings in the schema. */
  readonly kinds: ReadonlySet<string>;

  /**
   * Derived getChildren function.
   *
   * For each node, returns its children by collecting all child/optChild/list
   * fields in declaration order. This replaces the manual getChildren().
   */
  readonly getChildren: (node: N) => N[];

  /**
   * Check completeness of a production equation map.
   *
   * Returns kinds that have no equation and no '_' default.
   */
  checkCompleteness(equations: Record<string, unknown>): string[];

  /**
   * Get the NodeDef for a specific kind.
   */
  getDef(kind: string): NodeDef | undefined;

  /**
   * Get child field names for a kind.
   */
  getChildFields(kind: string): readonly string[];
}

// ── Schema construction ──────────────────────────────────────────────

/**
 * Create a node schema from an array of NodeDef entries.
 *
 * @param defs - All node definitions for this grammar
 * @param kindField - The discriminant field name (default: 'kind')
 * @param childrenField - The flat children array field (default: 'children')
 */
export function createNodeSchema<N extends object>(
  defs: NodeDef[],
  kindField: string = 'kind',
  childrenField: string = 'children',
): NodeSchema<N> {
  const defMap = new Map<string, NodeDef>();
  for (const def of defs) {
    if (defMap.has(def.kind)) {
      throw new Error(`Duplicate node kind: '${def.kind}'`);
    }
    defMap.set(def.kind, def);
  }

  const kinds = new Set(defMap.keys());

  // Build getChildren: for nodes with named children, collect them in order.
  // For nodes without named children, fall back to the flat children array.
  function getChildren(node: N): N[] {
    const kind = (node as any)[kindField] as string;
    const def = defMap.get(kind);

    if (!def || def.childFields.length === 0) {
      // Leaf or unknown node — use flat children array
      return (node as any)[childrenField] ?? [];
    }

    // Collect named children in declaration order
    const result: N[] = [];
    for (const field of def.childFields) {
      const value = (node as any)[field];
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item != null) result.push(item);
        }
      } else {
        result.push(value);
      }
    }
    return result;
  }

  function checkCompleteness(equations: Record<string, unknown>): string[] {
    if ('_' in equations) return []; // default handler covers all
    const missing: string[] = [];
    kinds.forEach(kind => {
      if (!(kind in equations)) {
        missing.push(kind);
      }
    });
    return missing;
  }

  function getDef(kind: string): NodeDef | undefined {
    return defMap.get(kind);
  }

  function getChildFields(kind: string): readonly string[] {
    return defMap.get(kind)?.childFields ?? [];
  }

  return {
    defs: defMap,
    kinds,
    getChildren,
    checkCompleteness,
    getDef,
    getChildFields,
  };
}
