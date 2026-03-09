> **SUPERSEDED**: This document references the pre-three-object architecture (AGSpecInput, syn(), inh(), match(), Grammar.evaluate()). The codebase now uses the three-object architecture (Grammar, Semantics, interpret). See `three-object-separation-plan.md` for the current design.

# AG Library: From Toolkit to Weak Interpreter

Analysis of current state vs target architecture, informed by Cousot's abstract interpretation
framework and the `scratch-abstract-interpreters` codebase.

---

## Part 1: The Theoretical Grounding

### Attribute Grammars ARE Abstract Interpreters

Cousot established this explicitly (TCS 2003, TCS 2011): an attribute grammar evaluator is
an abstract interpreter. The mapping is precise:

| Abstract Interpretation | Attribute Grammar | Current @ksc/ag |
|---|---|---|
| Abstract domain | Attribute value type | Return type of `syn`/`match`/etc compute fn |
| Transfer function | Semantic equation | Compute closure inside `syn(...)`, `match(...)` |
| Collecting semantics | Attribute evaluation | `applyAttributes` walk |
| Fixpoint iteration | Circular evaluation | `circular(init, compute)` |
| Abstract interpreter | AG evaluator | **Missing — user manually orchestrates** |

The last row is the gap.

### Cousot's Two-Phase Architecture

From SAS 1997:

> "The abstract interpreter is usually designed in two phases: in the first phase,
> a **translator** maps the program concrete syntax to an abstract semantics
> **specification** (e.g., a system of equations), and in a second phase, that
> specification is **solved** to compute the abstract semantics."

**Phase 1**: Specification — define the equation system (attribute grammar)
**Phase 2**: Solving — evaluate the equations (the evaluator / weak interpreter)

The AG library should embody both phases. Currently it only provides building blocks
for Phase 1, and leaves Phase 2 orchestration to the consumer.

### What "Weak Interpreter" Means

A concrete interpreter executes a program in the concrete domain, producing exact results.
A **weak interpreter** (abstract interpreter) executes the same program in an abstract
domain, producing sound approximations.

The "weakness" is the approximation: instead of computing exact values, it computes
abstract properties (types, scopes, definitions, data-flow facts). It "interprets" the
program by walking its structure and applying transfer functions — but in a weaker
(less precise, decidable) domain.

An AG evaluator is precisely this: it walks the syntax tree and computes abstract
properties using semantic equations as transfer functions.

---

## Part 2: Current State — A Toolkit, Not a Framework

### What the AG Library Provides Today

**Primitives** (building blocks):
- `stampTree(root, getChildren)` — stamp navigation on nodes
- `applyAttributes(root, defs)` — install lazy getters on all nodes
- `installLazy(node, key, compute)` — core caching mechanism

**Attribute factories** (equation constructors):
- `syn`, `uncached`, `paramSyn` — synthesized
- `match` — per-production dispatch
- `down`, `atRoot` — inherited
- `coll` — collection (subtree aggregation)
- `lookup` — reference (global symbol table)
- `circular` — fixed-point iteration
- `chain` — threaded (DFS pre-order)

**Types**:
- `AttributeDef<N, V>` — a spec object with `install(node, key)`
- `StampedNode` — navigation properties
- `AttributeMap<N>` — `Record<string, AttributeDef<N>>`

### What the Consumer Does Today (binder.ts)

```typescript
export function applyBinderAttributes(ksTree: KSTree): void {
  let nextDefId = 0;

  // 1. Consumer creates attribute defs using factories
  const kindDefs = match<KSNode, KindDefinition[]>('kind', { ... });
  const defLookup = lookup<KSNode, string, KindDefinition>((node) => { ... });

  // 2. Consumer manually calls applyAttributes
  applyAttributes(ksTree.root, { kindDefs, defLookup });
}
```

And in `convert.ts`:
```typescript
export function buildKSTree(tsProgram: ts.Program): KSTree {
  // ... build tree ...
  stampTree(root, getChildren);  // Consumer calls this manually
  return { root };
}
```

And in `program.ts`:
```typescript
const ksTree = buildKSTree(tsProgram);      // Step 1: consumer builds tree
applyBinderAttributes(ksTree);               // Step 2: consumer applies attributes
// Step 3: consumer accesses properties
(cu as any).kindDefs
```

### What's Wrong With This

The consumer is doing the AG library's job:

1. **Tree preparation is manual** — consumer must call `stampTree` before `applyAttributes`
2. **Orchestration is manual** — consumer sequences tree building → stamping → attribute application
3. **The "spec" is implicit** — there's no single object that says "here is my attribute grammar"
4. **No clear input/output contract** — `applyAttributes` mutates in place, returns nothing
5. **Phase ordering is invisible** — if attribute B depends on attribute A (e.g., `defLookup` reads `kindDefs`), the consumer must know to put them in the same `applyAttributes` call and trust lazy evaluation order
6. **No separation of domain from equations** — the attribute grammar has no explicit domain description, no explicit notion of what it's computing or what properties the results have

Compare with `scratch-abstract-interpreters`:

```typescript
// CLEAR SPEC with explicit domain, transfer functions, init, deps
const spec: InterpreterSpec<TaintState> = {
  id: "taint",
  domain: {
    name: "Taint Analysis",
    getDiagnostics: (state) => state.diagnostics,
    equals: (a, b) => setsEqual(a.tainted, b.tainted),
  },
  rules: taintRules,     // Transfer functions keyed by SyntaxKind
  init: (sf) => emptyTaintState(),
  deps: [],              // No dependencies on other analyses
};

// FRAMEWORK DOES THE REST
const result = runInterpreter(spec, sourceFile);
```

The spec is a **single, self-contained object**. The framework takes it and does everything.

---

## Part 3: Target State — The AG Library as Weak Interpreter Framework

### The Core Idea

The AG library should accept a **grammar specification** and return an **evaluator function**
that takes an AST and produces an attributed AST. The spec is the "abstract semantics
specification" (Cousot Phase 1). The evaluator is the "solver" (Cousot Phase 2).

### Proposed API

```typescript
// ─── The Spec ───────────────────────────────────────────────────────────

/**
 * A complete attribute grammar specification.
 *
 * This is the single object that fully defines an analysis.
 * Analogous to InterpreterSpec in scratch-abstract-interpreters,
 * and to a .jrag specification in JastAdd.
 */
interface AGSpec<N extends object> {
  /** Human-readable name for this grammar */
  name: string;

  /**
   * How to extract children from a node.
   * This is the tree structure definition.
   */
  children: (node: N) => N[];

  /**
   * The attribute equations.
   * Each entry maps an attribute name to its definition.
   * The AG library provides factories (syn, match, down, coll, etc.)
   * to construct these.
   */
  attributes: AttributeMap<N>;

  /**
   * Optional: dependencies on other grammars that must be applied first.
   * Analogous to `deps` in scratch-abstract-interpreters.
   */
  deps?: string[];
}

// ─── The Evaluator ──────────────────────────────────────────────────────

/**
 * Create a weak interpreter from an AG specification.
 *
 * Returns a function that takes an AST root and returns the same tree
 * with all attributes installed as lazy properties on every node.
 *
 * This is Cousot's Phase 2 — the solver.
 */
function createEvaluator<N extends object>(
  spec: AGSpec<N>,
): (root: N) => N;

// Or if we want to be explicit about what the evaluator does:
function evaluate<N extends object>(
  spec: AGSpec<N>,
  root: N,
): N;
```

### How the Binder Would Look

```typescript
import { evaluate, syn, match, lookup } from '@ksc/ag';
import type { AGSpec } from '@ksc/ag';

function binderSpec(): AGSpec<KSNode> {
  let nextDefId = 0;

  return {
    name: 'ksc-binder',
    children: getChildren,
    attributes: {
      kindDefs: match<KSNode, KindDefinition[]>('kind', {
        CompilationUnit: (cu) => {
          const defs: KindDefinition[] = [];
          for (const stmt of cu.children) {
            if (stmt.kind !== 'TypeAliasDeclaration') continue;
            const def = tryExtractKindDef(stmt as KSTypeAliasDeclaration, () => `kdef-${nextDefId++}`);
            if (def) defs.push(def);
          }
          return defs;
        },
        _: () => [],
      }),

      defLookup: lookup<KSNode, string, KindDefinition>((node) => {
        if (node.kind !== 'CompilationUnit') return [];
        const defs: KindDefinition[] = (node as any).kindDefs;
        return defs.map((d) => [d.name, d] as [string, KindDefinition]);
      }),
    },
  };
}

// Usage in program.ts:
const root = buildRawTree(tsProgram);          // Just build the AST, no stamping
const attributedRoot = evaluate(binderSpec(), root);  // AG library does everything
```

### What Changes

| Concern | Current (toolkit) | Target (framework) |
|---|---|---|
| Tree stamping | Consumer calls `stampTree` | `evaluate` handles it internally |
| Attribute installation | Consumer calls `applyAttributes` | `evaluate` handles it internally |
| Children accessor | Consumer provides to `stampTree` separately | Part of spec (`spec.children`) |
| Spec definition | Implicit (loose `Record<string, AttributeDef>`) | Explicit (`AGSpec` interface) |
| Return value | Nothing (mutates in place) | Returns the attributed tree |
| Orchestration | Consumer sequences calls | `evaluate` does it all |
| Phase ordering | Consumer's responsibility | Framework handles via lazy evaluation + deps |

---

## Part 4: Collection Attributes for the Binder

### Why Collection Attributes Matter

The binder's `defLookup` is currently implemented as a `lookup` attribute — which is really
a specialized `coll` + `atRoot` composition. But what the binder conceptually needs is a
**collection attribute** in the JastAdd sense:

> "Aggregate contributions from anywhere in the tree, targeting a specific node."

Currently `coll` only collects from the subtree rooted at the evaluated node. The binder
needs to collect from the entire tree (all CompilationUnits contribute definitions to a
global table). That's why `lookup` exists — it's a workaround for the missing "whole-tree
collection" capability.

### How JastAdd Does It

```java
// Declaration: collect on the root, combining with Map.putAll
coll Map<String, KindDef> Program.allDefs() [new HashMap<>()] with putAll;

// Contributions: from any CompilationUnit in the tree
CompilationUnit contributes kindDefsMap()
  to Program.allDefs();
```

JastAdd's collection has two phases:
1. **Survey**: walk from collection root, find all contributor nodes
2. **Collect**: evaluate contributions and combine with the declared operator

### How This Maps to Our AG Library

The existing `coll` primitive already supports this pattern when applied at the right
node (the root). The `lookup` attribute is essentially:

```
lookup = coll(at root) + share result to all descendants
```

Which is `coll` + `atRoot` composed. The current implementation is correct — `lookup`
IS the collection attribute for whole-tree aggregation. It just needs better framing
in the spec.

### Potential Enhancement: Explicit Collection Spec

```typescript
// More explicit than current lookup — makes the collection nature visible
const defLookup = collection<KSNode, string, KindDefinition>({
  scope: 'global',              // Collect from entire tree (vs 'subtree')
  collect: (node) => { ... },   // What each node contributes
  combine: 'map',               // How to combine (map, set, array, custom)
  access: 'lookup',             // Result is a lookup function, not the raw collection
});
```

This would make the intent clearer while the implementation remains the same `lookup`
mechanism under the hood.

---

## Part 5: What the AG Library Owns vs Consumer

### AG Library Owns (implemented)

1. **Tree preparation** — `stampTree` is internal to `evaluate`
2. **Attribute installation** — `applyAttributes` is internal to `evaluate`
3. **Composition** — `evaluateAll` composes multiple `AGSpec`s with dependency ordering
4. **Spec contract** — `AGSpec<N, R>` with `AGDomain<N, R>` for result projection
5. **Low-level primitives** — `stampTree`, `applyAttributes`, `installLazy` remain
   exported for advanced use cases (e.g., convert tests that test tree structure)

### Consumer Owns

1. **Domain-specific extraction logic** — `tryExtractKindDef`, `extractPropertiesFromTypeLiteral`
   are KSC-specific; they belong in the binder, not the AG library
2. **AST node types** — `KSNode`, `KSTypeAliasDeclaration`, etc. are the consumer's concern
3. **Children accessor** — the consumer knows the tree structure; it provides `getChildren`
   as part of the spec
4. **Transfer functions** — the compute closures inside `syn`, `match`, etc. are the
   consumer's semantic equations

---

## Part 6: Comparison with scratch-abstract-interpreters

### Structural Alignment

| scratch-abstract-interpreters | @ksc/ag |
|---|---|
| `InterpreterSpec<D>` | `AGSpec<N, R>` |
| `spec.id` | `spec.name` |
| `spec.domain` | `spec.domain: AGDomain<N, R>` |
| `spec.rules` (transfer map) | `spec.attributes` (attribute map) |
| `spec.init` | Not needed — lazy evaluation |
| `spec.deps` | `spec.deps` |
| `runInterpreter(spec, sourceFile)` | `evaluate(spec, root)` |
| `InterpreterResult<D>` | `R \| undefined` (domain projection) |
| `TransferFn<D>` | Compute closure in `syn(...)` |
| `TransferContext<D>` | Node properties: `$parent`, `$children`, other attributes |

### Key Difference: State Threading vs Property Stamping

The scratch framework uses **explicit state threading**: transfer functions receive state,
transform it, return new state. The framework threads state through the tree walk.

```typescript
// scratch: state flows through the tree walk
[ts.SyntaxKind.IfStatement](node, ctx) {
  let s = ctx.eval(stmt.expression, ctx.state);
  const thenResult = ctx.eval(stmt.thenStatement, s);
  return merge(thenResult, elseResult);
}
```

Our AG library uses **demand-driven property stamping**: attributes are lazy getters that
compute on first access. There's no explicit state threading — dependencies are resolved
by reading other attributes.

```typescript
// @ksc/ag: attributes access each other via property reads
const kindDefs = match('kind', {
  CompilationUnit: (cu) => { /* compute from cu.children */ },
});

const defLookup = lookup((node) => {
  const defs = (node as any).kindDefs;  // reads kindDefs attribute
  return defs.map(d => [d.name, d]);
});
```

This is a **fundamental architectural choice**, not a gap. Both approaches are valid
instantiations of Cousot's framework:
- State threading = forward abstract interpretation (like dataflow analysis on a CFG)
- Property stamping = demand-driven abstract interpretation (like AG evaluation)

The AG approach is better for tree-structured programs where you want synthesized +
inherited attributes. The state-threading approach is better for imperative programs
where state flows sequentially through statements.

### What We Learned from scratch-abstract-interpreters

1. **Single spec object** — everything about an analysis in one place → `AGSpec`
2. **Named analysis** — `spec.id` / `spec.name` for debugging and composition → `spec.name`
3. **Explicit dependencies** — `spec.deps` for ordering multiple analyses → `spec.deps`
4. **Domain descriptor** — scratch has `spec.domain.getDiagnostics` → `spec.domain.project`
5. **Clean separation** — the framework provides the walker, the spec provides the equations

---

## Part 7: Implementation — COMPLETE

### What Was Implemented

**AG Library** (`libs/ag/src/`):

- `types.ts` — added `AGDomain<N, R>` and `AGSpec<N, R>` interfaces
- `evaluate.ts` — new file with `evaluate()` and `evaluateAll()`
- `index.ts` — exports `AGSpec`, `AGDomain`, `evaluate`, `evaluateAll`

```typescript
// types.ts
interface AGDomain<N extends object, R = unknown> {
  name: string;
  project?: (root: N) => R;
}

interface AGSpec<N extends object, R = unknown> {
  name: string;
  domain: AGDomain<N, R>;
  children: (node: N) => N[];
  attributes: AttributeMap<N>;
  deps?: string[];
}

// evaluate.ts
function evaluate<N extends object, R>(spec: AGSpec<N, R>, root: N): R | undefined;
function evaluateAll<N extends object>(specs: AGSpec<N, any>[], root: N): Map<string, unknown>;
```

**KSC Pipeline**:

- `convert.ts` — removed `stampTree` call; `buildKSTree` returns a raw tree
- `binder.ts` — exports `createBinderSpec()` returning `AGSpec<KSNode, KindDefinition[]>`
- `program.ts` — calls `evaluate(createBinderSpec(), ksTree.root)` to get definitions
- `index.ts` — exports `createBinderSpec` instead of `applyBinderAttributes`

### The Binder as AGSpec

```typescript
export function createBinderSpec(): AGSpec<KSNode, KindDefinition[]> {
  return {
    name: 'ksc-binder',
    domain: {
      name: 'Kind Definitions',
      project: (root) => {
        // Extract all kind definitions from the attributed tree
        return root.compilationUnits.flatMap(cu => cu.kindDefs);
      },
    },
    children: getChildren,
    attributes: { kindDefs, defLookup },
  };
}

// Usage:
const ksTree = buildKSTree(tsProgram);
const allDefs = evaluate(createBinderSpec(), ksTree.root) ?? [];
```

### Design Decisions

- The `domain` field with `project` is included — it provides a standard way to extract
  analysis results from the attributed tree (analogous to `getDiagnostics` in
  scratch-abstract-interpreters)
- Property-stamping mechanism is unchanged — it's correct and efficient
- No `TransferContext` — the AG approach doesn't need one; nodes access each other
  via properties, which is more natural for tree-structured data
- `evaluateAll` with topological sorting by `deps` is included for multi-spec composition

### Verification

- 66 AG library tests (10 test files) — all passing
- 40 root KSC tests (5 test files) — all passing
- `tsc --noEmit` clean
- Showcase runs successfully

---

## Summary

| | Before | After |
|---|---|---|
| **What is the AG library?** | A toolkit of attribute factories | A weak interpreter framework |
| **What does the consumer provide?** | Loose AttributeDefs + manual orchestration calls | A single `AGSpec` object |
| **What does the AG library do?** | Provides building blocks | Takes a spec, produces an attributed tree |
| **Where is the orchestration?** | Consumer side (binder.ts, convert.ts, program.ts) | AG library (`evaluate`) |
| **What's the contract?** | Implicit (call stampTree then applyAttributes) | Explicit: `evaluate(spec, root) → R` |
| **How many calls?** | 3+ (build tree, stamp, apply, ...) | 1: `evaluate(spec, root)` |
| **Domain descriptor?** | None | `AGDomain` with `project()` for result extraction |
| **Multi-spec composition?** | Manual | `evaluateAll` with dependency ordering |
