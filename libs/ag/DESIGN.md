# Design: `libs/ag` — Attribute Grammar Library for TypeScript

## Context

We're building a general-purpose attribute grammar (AG) library in TypeScript, aligned to JastAdd's nomenclature and core primitives. This document covers the research, design decisions, API, and roadmap.

---

## The Three Reference Systems

### JastAdd — Metacompiler (Lund University)

JastAdd is a **code generator**. You write `.jrag` (declarative) and `.jadd` (imperative) files containing attribute equations in a grammar notation. JastAdd reads those files and **emits Java classes** — one per AST nonterminal — with attribute evaluation logic woven in as methods.

The generated code includes:
- Cache fields per attribute (`_computed_x` / `_value_x` boolean + value pairs)
- Circular evaluation state machine (`CircleState` with cycle ID, change flag, visited set)
- Inherited attribute dispatch tables (`Define_attrName(caller)` checks which child is asking, evaluates the correct equation, or delegates to grandparent)
- Collection attribute two-phase infrastructure (survey phase builds `contributorMap` via `IdentityHashMap`, then computation phase calls `contributeTo_x()` on each contributor)
- Rewrite triggers (lazy declarative tree rewriting)
- Incremental evaluation support (dependency tracking in cache fields for re-evaluation after AST edits)

You never write this boilerplate yourself. ExtendJ (a full Java 8 compiler) is ~100+ `.jrag` files that JastAdd compiles into a complete compiler.

### Silver — Standalone Language (U. Minnesota / MELT)

Silver goes further — it's a **full standalone language** with its own type system, pattern matching, and module system. You write `.sv` files; the Silver compiler translates them to Java. Silver is self-hosting (written in Silver).

Beyond basic AG evaluation, Silver provides:
- **Forwarding** — delegation to synthesized trees, enabling modular language extension
- **Collection attributes** with `<-` contribution syntax (first-class language feature)
- **Modular well-definedness analysis (MWDA)** — static check that independently-developed grammar extensions compose correctly
- **Automatic copy equations** for inherited attributes (`autocopy`)
- **Decorated vs. undecorated tree** distinction (explicit separation of structure from computed attributes)

ableC (extensible C compiler) and MELT's various DSLs are built in Silver.

### Kiama — Scala Library (Macquarie University)

Kiama is **just a Scala library**. No code generation, no grammar notation, no separate compilation step.

You write Scala code that calls `attr { case ... => ... }` and get back a function. The caching is a HashMap inside the closure. Circular evaluation uses module-level flags. Tree relations are computed by a `Tree` class that builds WeakHashMaps.

**Core API:**
- `attr { case node => value }` — cached synthesized attribute, returns `CachedAttribute[T,U]` extending `T => U`
- `paramAttr(f: V => T => U)` — parameterized attribute, cache key = `(param, node)` using identity hash
- `circular(init)(f)` — fixed-point iteration using Magnusson-Hedin algorithm
- `Tree[T, R]` — external parent/child relations via `Relation[T,U]` with memoized maps
- Inherited: `inh(rootValue, eq?)`

---

## The Completeness Gap: Why It Exists

JastAdd and Silver handle things that Kiama simply doesn't, because their completeness comes from **code generation** — they can emit arbitrary per-production, per-attribute, per-child boilerplate at compile time. That's not available to a runtime library.

### Inherited attribute dispatch

**JastAdd** generates per-child dispatch methods on parent nodes. When a child asks for an inherited attribute, the parent checks *which child is asking* and evaluates the appropriate equation. This means a `Block` can give its `declarations` child a different `env` than its `body` child.

**Kiama's `down`** just walks up the tree looking for an ancestor that matches — it can't distinguish "my left child asks for `env`" from "my right child asks for `env`" without the match function explicitly checking child identity via the Tree. @ksc/ag now uses the JastAdd/Silver-style parent-defined approach: `inh(rootValue, eq?)` where `eq(parent, child, childIndex)` provides per-child differentiation.

### Collection attributes

**JastAdd** generates a two-phase system: survey phase builds a `contributorMap` (IdentityHashMap mapping target nodes to lists of contributing nodes), then computation phase visits contributors and aggregates via `contributes...to...for`. **Silver** has it as first-class syntax with `<-`. @ksc/ag does not implement JastAdd's directed `contributes...to...for` system, as it requires code generation to wire contributors to specific target nodes. Subtree aggregation is achieved via `syn` with a DFS walk — simpler but sufficient for a library.

### Circular attribute evaluation

All three support it. **JastAdd** uses the Magnusson-Hedin algorithm with global cycle tracking — all circular attributes encountered during a fixed-point cycle are iterated together until simultaneous convergence. This correctly handles interleaved circular dependencies across multiple attributes and nodes. **@ksc/ag now implements the same algorithm**: when a circular attribute is first accessed, it becomes the "cycle driver" and tracks all other circular attributes discovered during evaluation in a `cycleEntries` array. All members are re-evaluated each iteration until no value changes across the entire cycle. **Silver** and **Kiama** also support circular attributes but with simpler per-attribute iteration.

### Rewrites

**JastAdd** supports declarative tree rewriting — specify that a node should be transparently replaced. Generated code handles lazy rewrite triggers. **Silver** has forwarding (conceptually similar, designed for modular composition). **Kiama has neither.**

### Incremental evaluation

**JastAdd** supports re-evaluating only affected attributes after AST edits, with dependency tracking in generated cache fields. **Neither Silver nor Kiama has this.**

### Summary: Our Ceiling

Kiama shows the **subset of AG features expressible as a library** in a general-purpose language using closures, higher-order functions, and runtime caching. That's our ceiling without a build step.

---

## Design Principles

1. **JastAdd alignment.** API surface matches JastAdd's core primitives: `syn`, `inh`, `circular`, `match`. No non-JastAdd concepts (no Kiama `chain`, no custom `coll`/`lookup` shortcuts).
2. **Functional composition, not inheritance.** No base classes. Attributes are defined as specifications (AttributeDef). Composition via closures and function calls.
3. **Work with any AST.** Generic over node types. Not tied to TypeScript's AST.
4. **Stamp attributes directly on nodes.** JastAdd-style: `Object.defineProperty` lazy getters compute on first access, then replace themselves with cached data properties. No external WeakMaps or data structures.
5. **No code generation.** Pure TypeScript library. Accept the library ceiling.
6. **Consult reference source code.** Look at working implementations in JastAdd/Silver/Kiama throughout the build rather than inventing from scratch.

---

## API

### Core Types

```typescript
// A node with tree navigation stamped directly on it
interface StampedNode {
  $parent: StampedNode | undefined;
  $children: StampedNode[];
  $index: number;
  $root: boolean;
  $prev: StampedNode | undefined;
  $next: StampedNode | undefined;
}

// An attribute definition that can be installed on nodes
interface AttributeDef<N extends object, V = any> {
  install(node: N, key: string): void;
}

// Map of named attribute definitions
type AttributeMap<N extends object> = Record<string, AttributeDef<N>>;
```

### Tree Stamping

```typescript
// Stamp tree navigation ($parent, $children, $index, $root, $prev, $next) directly on nodes
function stampTree<N extends object>(root: N, getChildren: (node: N) => N[]): void;

// Install a lazy-computing getter that replaces itself with the cached value on first access
function installLazy<N extends object, V>(node: N, key: string, compute: (node: N) => V): void;
```

### Attribute Application

```typescript
// Walk every node, install lazy getters for each attribute from the spec
function applyAttributes<N extends object>(root: N, defs: Record<string, AttributeDef<N, any>>): void;
```

### Synthesized Attributes

```typescript
// Lazy-cached (JastAdd-style — installs lazy getter, computes on first access, caches as data property)
function syn<N extends object, V>(compute: (node: N) => V): AttributeDef<N, V>;

// Uncached (recomputed every access — JastAdd's "uncache")
function uncached<N extends object, V>(compute: (node: N) => V): AttributeDef<N, V>;

// Parameterized (JastAdd: syn T A.x(P param). Installs a curried lookup function, cached by param)
function paramSyn<N extends object, P, V>(
  compute: (node: N, param: P) => V,
): AttributeDef<N, (param: P) => V>;
```

### Circular Attributes

```typescript
// Fixed-point iteration (JastAdd: syn T A.x() circular [init])
// Implements the Magnusson-Hedin algorithm for inter-attribute/cross-node cycles.
function circular<N extends object, V>(
  init: V,
  compute: (node: N) => V,
  options?: { equals?: (a: V, b: V) => boolean },
): AttributeDef<N, V>;
```

### Inherited Attributes

```typescript
// Parent-defined inherited attribute (JastAdd: inh T A.x() + eq Parent.getChild().x()).
// Root receives rootValue (or rootValue(root) if a function).
// Non-root: eq(parent, child, childIndex) returns value, or undefined to auto-propagate.
// If eq is omitted, root value propagates to all descendants.
function inh<N extends object, V>(
  rootValue: V | ((root: N) => V),
  eq?: (parent: N, child: N, childIndex: number) => V | undefined,
): AttributeDef<N, V>;
```

### Per-Production Dispatch

```typescript
// Dispatch on a discriminant field (like JastAdd's per-subclass equations)
function match<N extends object, V>(
  discriminant: string,
  equations: Record<string, (node: any) => V> & { _?: (node: N) => V },
): AttributeDef<N, V>;
```

### Name Resolution Pattern (JastAdd-style)

Name resolution is not a primitive — it's a **composition pattern** using `syn`, `inh`, and `match`:

```typescript
// 1. Collect local definitions per scope node (syn via match)
const localDefs = match<Node, Map<string, Decl>>('kind', {
  Block: (node) => collectDeclsFromBlock(node),
  FuncDecl: (node) => collectParamsFromFunc(node),
  _: () => new Map(),
});

// 2. Propagate environment downward (inh), extending at scope boundaries
const env = inh<Node, Map<string, Decl>>(
  (root) => (root as any).localDefs,
  (parent, child, idx) => {
    if (isScopeNode(parent)) {
      return new Map([...(parent as any).env, ...(parent as any).localDefs]);
    }
    return undefined;  // auto-propagate
  }
);

// 3. Reference attribute: resolve a use to its declaration (syn)
const decl = syn<Node, Decl | undefined>((node) => {
  if (node.kind !== 'VarUse') return undefined;
  return (node as any).env.get(node.name);  // returns a node reference
});
```

This is exactly how ExtendJ (JastAdd's Java compiler) handles name resolution. The pattern composes with `circular` for class hierarchies and with `inh` for nested scope chains.

---

## Key Design Decisions

### Decision 1: Caching Strategy — Property stamping (JastAdd-style)
All attributes stamp directly onto nodes using `Object.defineProperty` lazy getters. First access computes the value, then the getter replaces itself with a plain data property (`writable: false, configurable: false`). Subsequent accesses are zero-cost direct property reads. No external WeakMaps.

### Decision 2: Circular State — Symbol-keyed node properties
Circular attribute iteration state is stored on nodes using a `Symbol('ag:circular')` keyed property. After convergence, the final value is stamped as a regular data property.

### Decision 3: Tree Construction — `stampTree` stamps navigation directly on nodes
BFS traversal stamps `$parent`, `$children`, `$index`, `$root`, `$prev`, `$next` as non-enumerable properties on every node. No external `Tree<N>` object.

### Decision 4: Inherited Attributes — Parent-defined (JastAdd/Silver-style)
`inh(rootValue, eq?)` uses parent-defined equations. Parent provides value to children via `eq(parent, child, childIndex)`. Auto-propagation via `return undefined`.

### Decision 5: Build Integration — TS project references

### Decision 6: JastAdd Nomenclature Alignment
API surface uses only JastAdd-equivalent primitives: `syn`, `inh`, `circular`, `match`, `paramSyn`, `uncached`. Removed non-JastAdd concepts: Kiama's `chain` (threaded attributes), custom `coll` (subtree fold — JastAdd's `coll` has different directed-contribution semantics), and `lookup` (convenience shortcut). Subtree aggregation and name resolution are achieved via composition of core primitives.

---

## File Structure

```
libs/ag/
├── src/
│   ├── index.ts           # Public API re-exports
│   ├── types.ts           # StampedNode, AttributeDef, AttributeMap, AGSpec
│   ├── stamp.ts           # installLazy, stampTree (core infrastructure)
│   ├── apply.ts           # applyAttributes (evaluator)
│   ├── evaluate.ts        # evaluate, evaluateAll (orchestration)
│   ├── syn.ts             # syn, uncached, paramSyn
│   ├── match.ts           # match (per-production dispatch)
│   ├── circular.ts        # circular (Magnusson-Hedin fixed-point)
│   ├── inh.ts             # inh (inherited attributes, parent-defined)
│   └── serialize.ts       # serializeTree, deserializeTree
├── test/
│   ├── stamp.test.ts
│   ├── syn.test.ts
│   ├── match.test.ts
│   ├── circular.test.ts
│   ├── inh.test.ts
│   ├── evaluate.test.ts
│   └── repmin.test.ts     # Classic integration test
├── DESIGN.md              # This document
├── tsconfig.json
└── package.json
```

---

## Implementation Roadmap

All phases complete. See `docs/architecture/ag-node-attribution-redesign.md` for the full implementation history.

### Phase 1: Core Infrastructure
`types.ts`, `stamp.ts`, `apply.ts`, `syn.ts`, `match.ts`, `index.ts`

### Phase 2: Tree-Navigating Attributes
`inh.ts`, `circular.ts` (Magnusson-Hedin)

### Phase 3: KSC Pipeline Migration
`src/pipeline/convert.ts` (stampTree), `src/pipeline/binder.ts` (inh+syn pattern), `src/pipeline/checker.ts`

### Phase 4: JastAdd Alignment
Removed non-JastAdd primitives (`lookup`, `chain`, `coll`). Migrated consumers to use `syn` + `inh` composition patterns. See `docs/architecture/jastadd-alignment-plan.md`.

### Verification
AG library tests + root KSC tests — all passing.
