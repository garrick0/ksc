/**
 * Attribute dependency analysis.
 *
 * Discovers cross-attribute dependencies at runtime, giving a library
 * the same dependency analysis that JastAdd computes statically.
 *
 * Approach: For each attribute, create a prototype-chained clone of
 * each sample node (via Object.create). Install tracking getters for
 * non-target attributes on the clone, install the real AttributeDef
 * for the target, then trigger it. The access log tells us which
 * attributes were read.
 */

import type { AttributeDef } from './types.js';
import { stampTree } from './stamp.js';

// ── Types ────────────────────────────────────────────────────────────────

/** The dependency graph: attribute name -> set of attribute names it reads. */
export type DepGraph = Map<string, Set<string>>;

/** Result of dependency analysis. */
export interface AnalysisResult {
  /** Attribute dependency graph: attr -> attrs it reads. */
  deps: DepGraph;

  /** Attribute evaluation order (topological sort, leaves first). */
  order: string[];

  /** Cycles detected in the attribute dependency graph (if any). */
  cycles: string[][];
}

// ── Analysis ─────────────────────────────────────────────────────────────

/**
 * Analyze attribute dependencies across compiled AttributeDefs.
 *
 * @param getChildren - Tree structure (from grammar)
 * @param compiled    - Map of attribute name -> compiled AttributeDef
 * @param sampleRoot  - A sample AST to run analysis on
 */
export function analyzeDeps<N extends object>(
  getChildren: (node: N) => N[],
  compiled: ReadonlyMap<string, AttributeDef<N>>,
  sampleRoot: N,
): AnalysisResult {
  const attrNames = new Set(compiled.keys());

  // Initialize dep graph
  const deps: DepGraph = new Map();
  for (const name of attrNames) {
    deps.set(name, new Set());
  }

  // Stamp tree navigation
  stampTree(sampleRoot, getChildren);

  // Collect sample nodes (one per kind for coverage)
  const sampleNodes = collectSampleNodes(sampleRoot);

  // For each target attribute, analyze what it reads
  for (const targetAttr of attrNames) {
    const targetDeps = deps.get(targetAttr)!;

    for (const node of sampleNodes) {
      const accessed = analyzeAttrOnNode(node, targetAttr, compiled, attrNames);
      for (const dep of accessed) {
        targetDeps.add(dep);
      }
    }
  }

  // Compute evaluation order and detect cycles
  const { order, cycles } = topoSortAttrs(deps);

  return { deps, order, cycles };
}

// ── Per-node analysis ────────────────────────────────────────────────────

function analyzeAttrOnNode<N extends object>(
  node: N,
  targetAttr: string,
  compiled: ReadonlyMap<string, AttributeDef<N>>,
  attrNames: Set<string>,
): Set<string> {
  const accessed = new Set<string>();

  const clone = Object.create(node) as N;

  for (const attrName of attrNames) {
    if (attrName === targetAttr) {
      compiled.get(attrName)!.install(clone, attrName);
    } else {
      installTrackingGetter(clone, attrName, accessed);
    }
  }

  // Create a parent clone with tracking getters (for inh attributes)
  const parent = (node as any).$parent;
  if (parent) {
    const parentClone = Object.create(parent);
    for (const attrName of attrNames) {
      if (attrName !== targetAttr) {
        installTrackingGetter(parentClone, attrName, accessed);
      }
    }
    Object.defineProperty(clone, '$parent', {
      value: parentClone,
      configurable: true,
      enumerable: false,
    });
  }

  try {
    void (clone as any)[targetAttr];
  } catch {
    // Equation might fail on sample data — partial deps still useful
  }

  return accessed;
}

function installTrackingGetter(
  node: any,
  attrName: string,
  accessed: Set<string>,
): void {
  Object.defineProperty(node, attrName, {
    configurable: true,
    enumerable: true,
    get() {
      accessed.add(attrName);
      return undefined;
    },
  });
}

// ── Sample nodes ─────────────────────────────────────────────────────────

function collectSampleNodes<N extends object>(root: N): N[] {
  const byKind = new Map<string, N>();
  const stack: N[] = [root];

  while (stack.length > 0) {
    const node = stack.pop()!;
    const kind = (node as any).kind ?? '__unknown__';
    if (!byKind.has(kind)) {
      byKind.set(kind, node);
    }
    const kids: N[] = (node as any).$children ?? [];
    for (const kid of kids) stack.push(kid);
  }

  return [...byKind.values()];
}

// ── Topological sort for attributes ──────────────────────────────────────

function topoSortAttrs(deps: DepGraph): { order: string[]; cycles: string[][] } {
  const order: string[] = [];
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function visit(name: string, path: string[]) {
    if (visited.has(name)) return;
    if (inStack.has(name)) {
      const cycleStart = path.indexOf(name);
      if (cycleStart >= 0) {
        cycles.push([...path.slice(cycleStart), name]);
      }
      return;
    }

    inStack.add(name);
    path.push(name);

    const neighbors = deps.get(name);
    if (neighbors) {
      for (const dep of neighbors) {
        visit(dep, path);
      }
    }

    path.pop();
    inStack.delete(name);
    visited.add(name);
    order.push(name);
  }

  for (const name of deps.keys()) {
    visit(name, []);
  }

  return { order, cycles };
}
