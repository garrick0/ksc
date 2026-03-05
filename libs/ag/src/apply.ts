/**
 * Attribute application — the "weak interpreter" evaluator.
 *
 * Takes a tree (already stamped with $children) and a map of
 * named attribute definitions. Walks every node and installs
 * lazy getters for each attribute. No values are computed yet —
 * that happens on demand when properties are accessed.
 */

import type { AttributeDef } from './types.js';

/**
 * Apply attribute definitions to every node in a tree.
 *
 * The tree must already have $children stamped (via stampTree).
 *
 * @param root - Root of the stamped tree
 * @param defs - Map of attribute name → AttributeDef
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
