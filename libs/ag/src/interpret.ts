/**
 * interpret() — the evaluator / orchestration layer.
 *
 * Takes a sealed Semantics and a tree root. Stamps tree navigation,
 * installs compiled attributes, projects results. This is "Cousot Phase 2":
 * the weak interpreter that evaluates the abstract semantics specification.
 *
 * Also contains stampTree (tree navigation stamping) and applyAttributes
 * (attribute installation) — the low-level primitives that interpret()
 * orchestrates.
 */

import type { Semantics } from './semantics.js';
import type { AttributeDef } from './compile.js';

// ── Types ────────────────────────────────────────────────────────────────

/** A node with tree navigation stamped on it by stampTree(). */
export interface StampedNode {
  $parent: StampedNode | undefined;
  $children: StampedNode[];
  $index: number;
  $root: boolean;
  $prev: StampedNode | undefined;
  $next: StampedNode | undefined;
}

// ── stampTree ────────────────────────────────────────────────────────────

/**
 * Stamp tree navigation properties directly onto every node.
 *
 * After calling stampTree(root, getChildren), every node has:
 *   $parent   — parent node (undefined for root)
 *   $children — array of child nodes
 *   $index    — child index in parent (-1 for root)
 *   $root     — true only for root node
 *   $prev     — previous sibling (undefined if first/root)
 *   $next     — next sibling (undefined if last/root)
 */
export function stampTree<N extends object>(
  root: N,
  getChildren: (node: N) => N[],
): void {
  const stamp = (node: N, key: string, value: unknown) => {
    Object.defineProperty(node, key, {
      value,
      writable: false,
      configurable: true,
      enumerable: false,
    });
  };

  // BFS traversal
  const queue: N[] = [root];
  stamp(root, '$parent', undefined);
  stamp(root, '$index', -1);
  stamp(root, '$root', true);
  stamp(root, '$prev', undefined);
  stamp(root, '$next', undefined);

  while (queue.length > 0) {
    const node = queue.shift()!;
    const kids = getChildren(node);
    stamp(node, '$children', kids);

    for (let i = 0; i < kids.length; i++) {
      const child = kids[i];
      stamp(child, '$parent', node);
      stamp(child, '$index', i);
      stamp(child, '$root', false);
      stamp(child, '$prev', i > 0 ? kids[i - 1] : undefined);
      stamp(child, '$next', i < kids.length - 1 ? kids[i + 1] : undefined);
      queue.push(child);
    }
  }
}

// ── applyAttributes ──────────────────────────────────────────────────────

/**
 * Apply attribute definitions to every node in a tree.
 *
 * The tree must already have $children stamped (via stampTree).
 *
 * @param root - Root of the stamped tree
 * @param defs - Map of attribute name -> AttributeDef
 */
export function applyAttributes<N extends object>(
  root: N,
  defs: Record<string, AttributeDef<N, any>>,
): void {
  const entries = Object.entries(defs);
  const stack: N[] = [root];

  while (stack.length > 0) {
    const node = stack.pop()!;

    for (const [name, def] of entries) {
      def.install(node, name);
      let agAttrs: Set<string> | undefined = (node as any).$agAttrs;
      if (!agAttrs) {
        agAttrs = new Set();
        Object.defineProperty(node, '$agAttrs', {
          value: agAttrs, enumerable: false, configurable: true, writable: false,
        });
      }
      agAttrs.add(name);
    }

    const kids: N[] | undefined = (node as any).$children;
    if (kids) {
      for (let i = kids.length - 1; i >= 0; i--) {
        stack.push(kids[i]);
      }
    }
  }
}

// ── interpret ────────────────────────────────────────────────────────────

/**
 * Evaluate a sealed Semantics over a tree.
 *
 * 1. Stamps tree navigation ($parent, $children, etc.)
 * 2. For each spec in topo order, installs its compiled attributes
 * 3. Projects results via spec.project()
 *
 * @returns Map of spec name -> projected result
 */
export function interpret<N extends object>(
  semantics: Semantics<N>,
  root: N,
): Map<string, unknown> {
  // 1. Stamp tree navigation
  stampTree(root, semantics.grammar.getChildren);

  // 2. Apply attributes for each spec in topo order
  const results = new Map<string, unknown>();

  for (const spec of semantics.specs) {
    const attrDefs: Record<string, any> = {};
    for (const [name, def] of spec.compiled) {
      attrDefs[name] = def;
    }
    applyAttributes(root, attrDefs);

    if (spec.project) {
      results.set(spec.name, spec.project(root));
    }
  }

  return results;
}
