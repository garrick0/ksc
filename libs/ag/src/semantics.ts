/**
 * Semantics — merged, validated, sealed algebra.
 *
 * Takes a Grammar (structure) and SpecInput[] (behavior),
 * validates, topo-sorts, compiles, and seals into an immutable object.
 */

import type { Grammar } from './grammar.js';
import type { SpecInput, AttrDecl } from './spec.js';
import { compile, type AttributeDef } from './compile.js';

// ── Types ────────────────────────────────────────────────────────────────

export interface SealedSpec<N extends object> {
  readonly name: string;
  readonly compiled: ReadonlyMap<string, AttributeDef<N>>;
  readonly project?: (root: N) => unknown;
}

export interface Semantics<N extends object> {
  /** The grammar this semantics was built for. */
  readonly grammar: Grammar<N>;

  /** Specs in topological (evaluation) order. */
  readonly specs: ReadonlyArray<SealedSpec<N>>;

  /** All attribute names, in spec-order. */
  readonly order: readonly string[];

  /** Lookup: attribute name -> its declaration. */
  readonly declarations: ReadonlyMap<string, AttrDecl>;

  /** Lookup: attribute name -> its compiled AttributeDef (ready to install). */
  readonly compiled: ReadonlyMap<string, AttributeDef<N>>;
}

// ── Construction ─────────────────────────────────────────────────────────

/**
 * Create a sealed Semantics from a grammar and specs.
 *
 * Validates (no duplicate attrs, no unknown deps, no circular deps),
 * topo-sorts specs, and compiles declarations + equations into AttributeDefs.
 */
export function createSemantics<N extends object>(
  grammar: Grammar<N>,
  specs: SpecInput<N, any>[],
): Semantics<N> {
  // 1. Topo-sort specs by deps
  const sorted = topoSort(specs);

  // 2. Validate: no duplicate attribute names across specs
  const seenAttrs = new Map<string, string>();
  for (const spec of sorted) {
    for (const attrName of Object.keys(spec.declarations)) {
      const owner = seenAttrs.get(attrName);
      if (owner && owner !== spec.name) {
        throw new Error(
          `Duplicate attribute '${attrName}' in specs '${owner}' and '${spec.name}'`,
        );
      }
      seenAttrs.set(attrName, spec.name);
    }
  }

  // 3. Compile: decl + eq -> AttributeDef
  const allDeclarations = new Map<string, AttrDecl>();
  const allCompiled = new Map<string, AttributeDef<N>>();
  const sealedSpecs: SealedSpec<N>[] = [];

  for (const spec of sorted) {
    const specCompiled = new Map<string, AttributeDef<N>>();
    for (const [name, decl] of Object.entries(spec.declarations)) {
      const eq = spec.equations[name];
      const attrDef = compile<N>(name, decl, eq);
      allDeclarations.set(name, decl);
      allCompiled.set(name, attrDef);
      specCompiled.set(name, attrDef);
    }
    sealedSpecs.push({
      name: spec.name,
      compiled: specCompiled,
      project: spec.project,
    });
  }

  // 4. Attribute evaluation order
  const order = [...allCompiled.keys()];

  return {
    grammar,
    specs: sealedSpecs,
    order,
    declarations: allDeclarations,
    compiled: allCompiled,
  };
}

// ── Topological sort ─────────────────────────────────────────────────────

function topoSort<N extends object>(
  specs: SpecInput<N, any>[],
): SpecInput<N, any>[] {
  const byName = new Map<string, SpecInput<N, any>>();
  for (const spec of specs) {
    byName.set(spec.name, spec);
  }

  const visited = new Set<string>();
  const result: SpecInput<N, any>[] = [];

  function visit(name: string, path: Set<string>) {
    if (visited.has(name)) return;
    if (path.has(name)) {
      throw new Error(`Circular dependency: ${[...path, name].join(' → ')}`);
    }

    const spec = byName.get(name);
    if (!spec) {
      throw new Error(`Unknown dependency: '${name}'`);
    }

    path.add(name);
    for (const dep of spec.deps ?? []) {
      visit(dep, path);
    }
    path.delete(name);

    visited.add(name);
    result.push(spec);
  }

  for (const spec of specs) {
    visit(spec.name, new Set());
  }

  return result;
}
