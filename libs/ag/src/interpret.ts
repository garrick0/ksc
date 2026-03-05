/**
 * interpret() — the evaluator / orchestration layer.
 *
 * Takes a sealed Semantics and a tree root. Stamps tree navigation,
 * installs compiled attributes, projects results. This is "Cousot Phase 2":
 * the weak interpreter that evaluates the abstract semantics specification.
 */

import type { Semantics } from './semantics.js';
import { stampTree } from './stamp.js';
import { applyAttributes } from './apply.js';

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
