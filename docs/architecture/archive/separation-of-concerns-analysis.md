# Separation of Concerns: Isolating the Specialization Approach

How to structure the system so we can change the AG library specialization strategy
(inference, codegen, declaration merging, etc.) with minimal impact on everything else.

## Current Coupling Map

Before proposing solutions, here is every coupling point in the system today.

> **Updated:** The architecture has been restructured into four AG modules.
> `libs/ag/` was split into `ag-behavior/` (spec vocabulary) and `ag-interpreter/`
> (evaluation engine). KSC specs moved to `ksc-behavior/`, orchestration to
> `ksc-interpreter/`. `src/` no longer imports from any `ag-*` module directly.

```
                       CONSUMERS
                    (CLI, dashboard, tests)
                          |
                    KSProgramInterface        <-- clean boundary
                          |
                      program.ts              <-- uses evaluate() from ksc-interpreter
                     /         \
           ast-schema        ksc-interpreter
           /generated           |
          (getChildren,     evaluate()
           allKinds)       /    |    \
                     ag-interpreter  ksc-behavior
                     (grammar,       (binder, checker,
                      semantics,      KindDefinition, etc.)
                      interpret)         |
                          |           ag-behavior
                          |           (SpecInput, AttrDecl)
                          |
                       AST types (KSNode union)
```

### Coupling inventory

| Boundary | Current coupling | Severity |
|----------|-----------------|----------|
| Consumer <-> Program | `KSProgramInterface` (6 methods) | **Clean** — consumers don't know about AG |
| Program <-> ksc-interpreter | `evaluate(root)` returns `EvaluationResult` | **Clean** — one function call |
| ksc-interpreter <-> ag-interpreter | `createGrammar`, `createSemantics`, `interpret`, `analyzeDeps` | **Tight** — but isolated inside ksc-interpreter |
| ksc-interpreter <-> ksc-behavior | `createBinderSpec()`, `createCheckerSpec()` | **Tight** — but isolated inside ksc-interpreter |
| ksc-behavior <-> ag-behavior | `SpecInput<KSNode>` format: `declarations` + `equations` + `deps` + `project` | **Tight** — specs are written in AG's vocabulary |
| ksc-behavior <-> AST types | Import specific interfaces (`KSTypeAliasDeclaration`, etc.), cast for attribute access (`(node as any).defLookup`) | **Tight** — coupled to node shape AND to computed attribute names |
| ag-interpreter <-> ag-behavior | Generic `AttrDecl`, `SpecInput` types | **Clean** — only type imports |
| ag-interpreter <-> Node type | Generic `N extends object` | **Clean** — AG is node-agnostic |
| ast.ts <-> ast-schema/generated | Re-exports `getChildren`, `allKinds`, `getChildFields` | **Clean** — pure generated code, no runtime library |

### What is already well-isolated

1. **Consumers** see only `KSProgramInterface`. The CLI, dashboard, and tests never touch the AG library directly. Changing the AG evaluation strategy is invisible to them.

2. **`src/` is fully insulated from AG internals.** `program.ts` calls `evaluate()` from `ksc-interpreter/` — it doesn't know about `createGrammar`, `createSemantics`, or `interpret`. All AG orchestration is encapsulated in `ksc-interpreter/evaluate.ts`.

3. **The AG engine (`ag-interpreter/` + `ag-behavior/`)** is generic over `N`. It doesn't know about `KSNode`. Swapping the engine is possible without touching KSC-specific code.

4. **Tree structure** is abstracted through `getChildren`. The AG engine receives this as a function parameter, not a hard dependency.

5. **Behavior and interpretation are separated.** `ksc-behavior/` defines WHAT to compute (specs + domain types). `ksc-interpreter/` defines HOW to run it (orchestration). `ag-behavior/` defines the generic AG vocabulary. `ag-interpreter/` is the generic evaluation engine.

### What is tightly coupled

1. **Specs are written in AG vocabulary.** `SpecInput` with `declarations` + `equations` is the AG library's format (from `ag-behavior/`). A spec is not portable to a different evaluation engine without rewriting.

2. **Specs use `(node as any).attrName` for attribute access.** This creates invisible runtime coupling between specs — the checker reads `defLookup` which is defined by the binder, but there's no type-level or import-level trace of this dependency.

3. **Specs hard-code equation bodies as closures.** The computation logic (how to extract kind definitions, how to check imports) is fused with the AG framework's equation format. You can't take the "business logic" and plug it into a different framework without extracting it.

---

## What Might Change

Before designing boundaries, we need to enumerate what we might actually want to swap:

| Component | Why it might change | Likelihood |
|-----------|-------------------|------------|
| AG evaluation engine | Switch from lazy-getter to incremental, visitor-based, or compiled | Medium |
| Type specialization approach | Switch from inference to codegen, or from codegen to declaration merging | Medium |
| Spec format | Evolve from `SpecInput` to a builder API, a DSL, or a richer declaration format | High |
| Node representation | Switch from plain objects to class instances, proxies, or a different schema | Low |
| Spec composition | Add new specs, split existing specs, allow user-defined specs | High |

The most likely changes are to the **spec format** and **spec composition** — we're already planning de-fusion and collection attributes. The AG evaluation engine might change if we need incremental re-evaluation. The type specialization approach is what the previous research explored.

---

## Option 1: Boundary Interfaces (Ports & Adapters)

**Core idea:** Define explicit interface types at each coupling point. The AG library becomes a swappable "engine" behind a port interface.

### Architecture

```
specs (binder, checker)
    |
    | implement SpecPort interface
    |
    v
EnginePort interface  <--  program.ts calls this
    ^
    |
    | implemented by
    |
AG engine adapter (wraps createGrammar + createSemantics + interpret)
```

### New interfaces

```typescript
// ports/spec-port.ts — what a spec looks like to the engine
interface SpecPort<N extends object> {
  name: string;
  declarations: Record<string, AttrDecl>;
  equations: Record<string, unknown>;
  deps?: string[];
  project?: (root: N) => unknown;
}

// ports/engine-port.ts — what an engine looks like to program.ts
interface EnginePort<N extends object> {
  evaluate(
    getChildren: (node: N) => N[],
    specs: SpecPort<N>[],
    root: N,
  ): Map<string, unknown>;

  analyzeDepGraph(
    getChildren: (node: N) => N[],
    specs: SpecPort<N>[],
    root: N,
  ): AttributeDepGraph;
}
```

### What changes when we swap the engine

- Write a new `EnginePort` implementation
- program.ts uses the new adapter — no other changes
- Specs remain unchanged (they implement `SpecPort`, which is identical to `SpecInput`)

### Assessment

| Dimension | Rating |
|-----------|--------|
| Isolation from engine changes | **Good** — program.ts only sees `EnginePort` |
| Isolation from spec format changes | **Poor** — `SpecPort` IS the spec format |
| Implementation cost | **Low** — extract two interfaces, one adapter |
| Type safety | **Same as today** — no improvement |
| Risk of over-abstraction | **Low** — it's just interfaces |

### Verdict

This is the **minimum viable separation**. It isolates program.ts from the AG library, but specs are still written in AG's vocabulary. If we change the spec format, all specs need rewriting regardless.

---

## Option 2: Separate Business Logic from AG Wiring

**Core idea:** Extract the actual computation logic (kind extraction, import checking) from the AG equation format. Specs become thin wiring layers that plug pure functions into the AG framework.

### Architecture

```
business-logic/
  kind-extraction.ts    — pure: extractKindDefs(node) -> KindDefinition[]
  import-analysis.ts    — pure: extractImports(node) -> Set<string>
  violation-check.ts    — pure: checkViolation(node, ctx) -> Diagnostic | null

specs/
  binder-spec.ts        — thin: wires kind-extraction into AG's SpecInput format
  checker-spec.ts       — thin: wires import-analysis + violation-check into SpecInput

engines/
  ag-engine.ts          — current AG library
  (future-engine.ts)    — hypothetical alternative
```

### Example

```typescript
// business-logic/kind-extraction.ts — PURE, no AG dependency
export function extractKindDefsFromCU(cu: KSNode): KindDefinition[] {
  const defs: KindDefinition[] = [];
  for (const stmt of cu.children) {
    if (stmt.kind !== 'TypeAliasDeclaration') continue;
    const def = tryExtractKindDef(stmt as KSTypeAliasDeclaration);
    if (def) defs.push(def);
  }
  return defs;
}

// specs/binder-spec.ts — thin wiring layer
import { extractKindDefsFromCU } from '../business-logic/kind-extraction.js';

export function createBinderSpec(): SpecInput<KSNode> {
  return {
    name: 'ksc-binder',
    declarations: {
      kindDefs: { direction: 'syn' },
      // ...
    },
    equations: {
      kindDefs: {
        CompilationUnit: extractKindDefsFromCU,
        _: () => [],
      },
      // ...
    },
  };
}
```

### What changes when we swap the engine

- Business logic functions are reused as-is
- Write new spec wiring for the new engine's format
- program.ts changes to use new engine

### What changes when we evolve the spec format

- Business logic functions are reused as-is
- Spec wiring layers get rewritten (but they're thin)

### Assessment

| Dimension | Rating |
|-----------|--------|
| Isolation from engine changes | **Good** — business logic survives intact |
| Isolation from spec format changes | **Good** — only thin wiring layers change |
| Implementation cost | **Medium** — refactor binder.ts and checker.ts to extract pure functions |
| Type safety | **Same as today** — attribute access still untyped |
| Risk of over-abstraction | **Low** — the split is natural (computation vs. wiring) |

### Verdict

This is the **best effort-to-value ratio**. The business logic (which is the hard part to write and test) becomes framework-independent. The AG wiring becomes thin enough that rewriting it for a new framework is straightforward.

---

## Option 3: Abstract Spec DSL with Compilation Targets

**Core idea:** Define a higher-level spec language (still in TypeScript) that compiles to the AG library's `SpecInput` format. If we change the AG engine, we write a new compiler backend.

### Architecture

```
spec-dsl/
  dsl.ts              — builder: attr('kindDefs').syn().eq(...)
  compile-to-ag.ts    — DSL -> SpecInput (current backend)
  (compile-to-X.ts)   — DSL -> future format

specs/
  binder.ts           — uses DSL builder API
  checker.ts          — uses DSL builder API
```

### Example

```typescript
// spec-dsl/dsl.ts
class SpecBuilder<N extends object> {
  private _name: string;
  private _attrs: AttrBuilder[] = [];
  private _deps: string[] = [];

  constructor(name: string) { this._name = name; }

  syn(name: string, eq: ...) { ... return this; }
  inh(name: string, root: ..., eq: ...) { ... return this; }
  collection(name: string, initial: ..., combine: ..., eq: ...) { ... return this; }
  dependsOn(...names: string[]) { ... return this; }
  project(fn: (root: N) => any) { ... return this; }

  // Compile to whatever target format
  toSpecInput(): SpecInput<N> { ... }
}

// specs/binder.ts
export const binderSpec = new SpecBuilder<KSNode>('ksc-binder')
  .syn('kindDefs', { CompilationUnit: extractKindDefsFromCU, _: () => [] })
  .inh('defEnv', { root: computeDefEnv })
  .syn('defLookup', node => (name: string) => (node as any).defEnv.get(name))
  .project(root => collectAllDefs(root))
  .toSpecInput();
```

### Assessment

| Dimension | Rating |
|-----------|--------|
| Isolation from engine changes | **Excellent** — DSL is a stable layer, only the compiler backend changes |
| Isolation from spec format changes | **Excellent** — the DSL IS the spec format |
| Implementation cost | **High** — must design, implement, and test a DSL |
| Type safety | **Potentially better** — DSL can enforce attribute typing |
| Risk of over-abstraction | **High** — DSL adds indirection, may fight TypeScript ergonomics |

### Verdict

This gives maximum isolation but at high cost. The DSL would need to be expressive enough to handle all attribute directions, production equations, collection attributes, etc. And it adds a layer that must be maintained. **Only justified if we expect to swap the AG engine more than once.**

---

## Option 4: Type-Safe Attribute Layer (Declaration Merging)

**Core idea:** Use TypeScript's declaration merging to create a typed attribute namespace. Specs declare their attributes in a shared type, and the AG engine makes them available at runtime with type safety.

### Architecture

```typescript
// attributes.ts — the shared attribute registry
interface NodeAttributes {
  // Binder attributes
  kindDefs: KindDefinition[];
  defEnv: Map<string, KindDefinition>;
  defLookup: (name: string) => KindDefinition | undefined;

  // Checker attributes (declaration merged)
  valueImports: Set<string>;
  fileImports: Set<string>;
  importViolation: CheckerDiagnostic | null;
  allViolations: CheckerDiagnostic[];
  // ...
}

// Type-safe attribute access
function readAttr<K extends keyof NodeAttributes>(
  node: KSNode, attr: K
): NodeAttributes[K] {
  return (node as any)[attr];
}
```

### In specs

```typescript
// Instead of (node as any).defLookup
const lookup = readAttr(node, 'defLookup');  // typed as (name: string) => KindDefinition | undefined
```

### Assessment

| Dimension | Rating |
|-----------|--------|
| Isolation from engine changes | **Moderate** — doesn't help with engine swapping |
| Isolation from spec format changes | **Moderate** — attributes are typed but equations aren't |
| Implementation cost | **Low** — one interface + one helper function |
| Type safety | **Much better** — attribute access is typed, typos caught at compile time |
| Risk of over-abstraction | **None** — it's just a type registry |

### Verdict

This is **orthogonal to engine swapping** but solves the most painful current problem: `(node as any).attrName` everywhere. It can be combined with any of the other options. Should be done regardless.

---

## Option 5: Engine-Agnostic Spec Protocol

**Core idea:** Define specs as objects implementing a protocol that is deliberately simpler than any specific AG library's interface. The protocol covers the 90% case; engine-specific features are opt-in extensions.

### Architecture

```typescript
// protocol/attr-protocol.ts
interface AttrSpec {
  name: string;
  direction: 'syn' | 'inh' | 'collection' | 'circular' | 'paramSyn';

  // For syn/collection: equation function or production map
  equation?: ((node: any) => any) | Record<string, (node: any) => any>;

  // For inh: root value + propagation equation
  rootValue?: any;
  propagate?: (parent: any, child: any, idx: number) => any;

  // For collection: monoid
  initial?: any;
  combine?: (acc: any, item: any) => any;

  // For circular: bottom + equality
  bottom?: any;
  equals?: (a: any, b: any) => boolean;
}

interface SpecProtocol {
  name: string;
  attrs: AttrSpec[];
  deps?: string[];
  project?: (root: any) => any;
}

// engine/adapt.ts — convert protocol to AG's SpecInput
function protocolToSpecInput<N extends object>(
  protocol: SpecProtocol
): SpecInput<N> {
  // mechanical translation
}
```

### Assessment

| Dimension | Rating |
|-----------|--------|
| Isolation from engine changes | **Good** — protocol is the stable layer |
| Isolation from spec format changes | **Good** — protocol insulates from AG's SpecInput |
| Implementation cost | **Medium** — design protocol + write adapter |
| Type safety | **Moderate** — protocol can carry types but adds complexity |
| Risk of over-abstraction | **Medium** — protocol must cover all attribute kinds |

### Verdict

A compromise between Option 1 (too thin) and Option 3 (too heavy). The protocol is simpler than a full DSL but provides a real abstraction barrier. **Worth it if we plan to experiment with multiple engines.**

---

## Recommendation: Option 2 + Option 4

The best path forward combines two orthogonal improvements:

### Do now: Option 2 (Separate Business Logic from AG Wiring)

**Why:** The business logic in binder.ts and checker.ts is the most valuable and stable part. Extracting it into pure functions gives us:
- Framework-independent computation logic
- Easier testing (test pure functions, not AG specs)
- Clean reuse if we swap the AG engine
- Natural module boundaries

**Effort:** ~2 hours. The binder has ~50 lines of business logic and ~30 lines of wiring. The checker has ~100 lines of business logic and ~50 lines of wiring. The split is natural — most functions already exist as helper functions.

### Do now: Option 4 (Type-Safe Attribute Layer)

**Why:** `(node as any).attrName` is the most fragile coupling in the system. A typed attribute registry makes attribute dependencies visible at compile time, prevents typos, and documents the contract between specs.

**Effort:** ~30 minutes. One interface, one accessor function, then update the ~15 attribute access sites.

### Do later (if needed): Option 1 (Engine Port Interface)

**Why:** If we actually start experimenting with alternative AG engines, extract an `EnginePort` interface so program.ts doesn't need to change. But this is premature until we have a second engine to test against.

### Don't do: Option 3 (DSL) or Option 5 (Protocol)

**Why:** Both add abstraction layers that we'd need to maintain and evolve alongside the AG library. The cost exceeds the benefit unless we're committed to supporting multiple evaluation engines simultaneously, which we're not.

---

## Migration Path

If we do Option 2 + Option 4, the diff looks like:

### Step 1: Extract business logic

```
src/pipeline/
  binder.ts           -> specs/binder-spec.ts (thin wiring)
  checker.ts          -> specs/checker-spec.ts (thin wiring)

  analysis/
    kind-extraction.ts  <- pure functions from binder
    import-analysis.ts  <- pure functions from checker
    violation-check.ts  <- pure functions from checker
```

### Step 2: Add attribute registry

```
src/pipeline/
  attributes.ts       <- NodeAttributes interface + readAttr()
```

### Step 3: Update specs to use readAttr()

Replace `(node as any).defLookup` with `readAttr(node, 'defLookup')` throughout.

### Resulting coupling map

> **Note:** The four-module refactor (ag-behavior, ag-interpreter, ksc-behavior,
> ksc-interpreter) has already achieved the first goal — `program.ts` no longer
> calls AG directly. The remaining options below address the deeper coupling
> within specs (untyped equations, `(node as any).attrName`).

```
                       CONSUMERS
                    (CLI, dashboard, tests)
                          |
                    KSProgramInterface        <-- clean (unchanged)
                          |
                      program.ts              <-- calls evaluate() from ksc-interpreter
                          |
                   ksc-interpreter            <-- encapsulates AG orchestration
                     /         \
           ksc-behavior     ag-interpreter
              /   \
         wiring  wiring                       <-- thin layers (if Option 2 applied)
                  /       \
            analysis/       <-- pure business logic (framework-independent)
            kind-extraction
            import-analysis
            violation-check
                  |
               AST types
                  |
            attributes.ts   <-- typed attribute access (if Option 4 applied)
```

The business logic layer (the expensive part to write) is now fully decoupled from the AG framework. If we later adopt a different evaluation engine, we:

1. Write new wiring layers (small)
2. Optionally extract an EnginePort (Option 1)
3. Business logic and attribute types remain untouched

---

## Summary Table

| Option | Isolates from | Cost | When |
|--------|--------------|------|------|
| 1. Boundary Interfaces | Engine swaps | Low | Later (when we have a second engine) |
| 2. Extract Business Logic | Engine AND format changes | Medium | **Now** |
| 3. Spec DSL | Everything | High | Never (unless we need multi-engine) |
| 4. Typed Attributes | Attribute coupling / bugs | Low | **Now** |
| 5. Spec Protocol | Engine swaps | Medium | Maybe (if experimenting with engines) |

**Recommended: Option 2 + Option 4 now. Option 1 later if needed.**
