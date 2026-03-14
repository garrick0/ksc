import type { Grammar, AttributeDepGraph } from '@ksc/grammar';
import type { AnalysisDecl, AttrDecl, EquationFn } from '../../domain/ports.js';
import { collectDepsForAttr } from '../equation-utils.js';
import type { BehaviorPlan } from '../../domain/plan.js';

// ── Build dep graph ──────────────────────────────────────────────────

function buildDepGraphFromAttrs(attrs: AttrDecl[]): {
  edges: [string, string][];
  order: string[];
} {
  const depMap = new Map<string, Set<string>>();
  const edges: [string, string][] = [];

  for (const attr of attrs) {
    const deps = new Set(collectDepsForAttr(attr));
    depMap.set(attr.name, deps);
    for (const dep of deps) {
      edges.push([attr.name, dep]);
    }
  }

  // Topological sort
  const order: string[] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function visit(name: string) {
    if (visited.has(name)) return;
    if (inStack.has(name)) throw new Error(`Cycle in dep graph: ${name}`);
    inStack.add(name);
    const neighbors = depMap.get(name);
    if (neighbors) for (const dep of neighbors) visit(dep);
    inStack.delete(name);
    visited.add(name);
    order.push(name);
  }

  for (const name of depMap.keys()) visit(name);

  return { edges, order };
}

export function buildDepGraph(attrs: AttrDecl[]): AttributeDepGraph {
  const { edges, order } = buildDepGraphFromAttrs(attrs);
  return {
    attributes: attrs.map(a => a.name),
    edges,
    order,
    declarations: Object.fromEntries(attrs.map(a => [a.name, { direction: a.direction }])),
  };
}

// ── Validation ───────────────────────────────────────────────────────

export function validateSpecConsistency(grammar: Grammar, attrs: AttrDecl[]): void {
  const { allKinds, fileContainerKind } = grammar;
  const hasKinds = allKinds.size > 0;
  const errors: string[] = [];

  if (hasKinds && !allKinds.has(fileContainerKind)) {
    errors.push(`fileContainerKind '${fileContainerKind}' is not a valid kind`);
  }

  for (const attr of attrs) {
    const eqs: Record<string, EquationFn> | undefined =
      attr.direction === 'syn' ? (attr.equations as Record<string, EquationFn> | undefined) :
      attr.direction === 'inh' ? (attr.parentEquations as Record<string, EquationFn> | undefined) :
      undefined;

    if (eqs) {
      for (const [kind, fn] of Object.entries(eqs)) {
        if (hasKinds && !allKinds.has(kind)) {
          errors.push(`Attr '${attr.name}': equation references unknown kind '${kind}'`);
        }
        if (!fn.name) {
          errors.push(`Attr '${attr.name}', kind '${kind}': equation function has no name (anonymous)`);
        }
      }
    }

    if (attr.direction === 'syn' && attr.default === undefined) {
      if (!eqs || Object.keys(eqs).length === 0) {
        errors.push(`Attr '${attr.name}': no default and no equations — attribute has no value`);
      } else if (!hasKinds) {
        errors.push(`Attr '${attr.name}': no default requires allKinds in grammar for exhaustiveness check`);
      } else {
        const eqKinds = new Set(Object.keys(eqs));
        const missing = [...allKinds].filter(k => !eqKinds.has(k));
        if (missing.length > 0) {
          errors.push(`Attr '${attr.name}': no default — missing equations for ${missing.length} kinds (first 5: ${missing.slice(0, 5).join(', ')})`);
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Analysis spec validation failed:\n  - ${errors.join('\n  - ')}`);
  }
}

// ── Planning ─────────────────────────────────────────────────────────

/**
 * Plan Behavior (IR Generation)
 *
 * Takes a grammar and an analysis declaration and produces a structured
 * BehaviorPlan that can be used for execution or code generation.
 */
export function planBehavior(grammar: Grammar, decl: AnalysisDecl): BehaviorPlan {
  const allAttrs = decl.attrs;
  validateSpecConsistency(grammar, allAttrs);
  const depGraph = buildDepGraph(allAttrs);

  return {
    grammar,
    decl,
    allAttrs,
    depGraph,
  };
}
