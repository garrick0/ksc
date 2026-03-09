# AG / AG-Schema / AST-Schema Boundary Analysis

> **Resolved:** Option 4 (merge ag-schema into ast-schema) was implemented as
> "Option B: Codegen Everything, No Runtime Library." `libs/ag-schema` has been
> deleted entirely. The codegen now generates all runtime structures as pure
> static code in `ast-schema/generated/schema.ts`.
>
> **Further resolved:** `libs/ag/` has since been split into `ag-behavior/`
> (spec vocabulary: SpecInput, AttrDecl) and `ag-interpreter/` (evaluation
> engine: grammar, semantics, interpret, compile, analyze). KSC-specific AG
> concerns were extracted to `ksc-behavior/` (specs + domain types) and
> `ksc-interpreter/` (orchestration). See
> [`extract-ksc-ag-plan.md`](extract-ksc-ag-plan.md) for the implementation
> record. The analysis of untyped equations (the "Equations Are AST-Blind"
> section below) remains a valid open concern.

## Current Architecture: Three Layers

```
ast-schema/          libs/ag-schema/        libs/ag/
(AST definition)     (node metadata)        (AG runtime)

schema.ts ──────┐
builder.ts      │   define.ts              spec.ts
                │   schema.ts              grammar.ts
codegen.ts ─────┤                          semantics.ts
                │   Uses ag-schema's       compile.ts
generated/ ─────┘   defineNode/            interpret.ts
  node-types.ts      createNodeSchema      analyze.ts
  node-defs.ts       at codegen time
  node-schema.ts
  convert.ts
  builders.ts
  serialize.ts
```

### What each layer does

**`ast-schema/`** declares all 360 AST node kinds, their fields, and sum type memberships. It has its own builder module (`builder.ts`) with `child()`, `optChild()`, `list()`, `prop()`, `node()`, `leaf()`, `sumType()` that populate a global registry. The `codegen.ts` script reads this registry and generates TypeScript source files.

**`libs/ag-schema/`** provides runtime node metadata: `defineNode()` produces `NodeDef` objects, `createNodeSchema()` collects them into a `NodeSchema` with a derived `getChildren()` and `checkCompleteness()`. The generated `node-defs.ts` and `node-schema.ts` USE this library.

**`libs/ag/`** is the generic AG runtime. It takes `N extends object` as a type parameter and knows nothing about specific AST structures. Grammar owns `getChildren`, Semantics merges + validates specs, `interpret()` stamps trees and installs attributes.

### How they connect today

```
ast-schema/schema.ts
    │ (codegen)
    ▼
ast-schema/generated/node-defs.ts  ──imports──▶  libs/ag-schema (defineNode, etc.)
ast-schema/generated/node-schema.ts ─imports──▶  libs/ag-schema (createNodeSchema)
ast-schema/generated/node-schema.ts ─exports──▶  getChildren
    │
    ▼
src/pipeline/node-defs.ts ──re-exports──▶ getChildren
    │
    ▼
src/program.ts
    ├── createGrammar(getChildren)          ──▶  libs/ag
    ├── createSemantics(grammar, [specs])   ──▶  libs/ag
    └── interpret(semantics, root)          ──▶  libs/ag
```

The connection is narrow: ast-schema produces `getChildren` via ag-schema, then the AG library uses it. That is the **only** point where schema knowledge flows into the AG system.

---

## The Core Problem: Equations Are AST-Blind

### How attributes/equations are currently defined

A `SpecInput` (from `libs/ag/src/spec.ts`) has:

```typescript
interface SpecInput<N extends object, R = unknown> {
  name: string;
  declarations: Record<string, AttrDecl>;       // WHAT: direction + metadata
  equations: Record<string, unknown>;            // HOW: computation — UNTYPED
  deps?: string[];
  project?: (root: N) => R;
}
```

The `equations` field is `Record<string, unknown>`. There is zero type-level knowledge of what the equation should look like.

### How production dispatch works

When an equation is an object (not a function), `compile.ts` calls `makeDispatch()`:

```typescript
function makeDispatch<N>(equations: Record<string, (node: any) => any>, discriminant: string) {
  return (node: N): any => {
    const key = (node as Record<string, unknown>)[discriminant] as string;
    const eq = equations[key];
    if (eq) return eq(node);
    if (equations._) return equations._(node);
    throw new Error(`match: no equation for '${key}' and no default '_' provided`);
  };
}
```

This dispatches on `node.kind` at runtime. The kind strings (`CompilationUnit`, `TypeAliasDeclaration`, etc.) are embedded in equation objects written by hand:

```typescript
// From binder.ts
equations: {
  kindDefs: {
    CompilationUnit: (cu: KSNode) => { ... },
    _: () => [],
  },
}
```

### What's wrong with this

1. **No completeness checking.** A production map with `{ CompilationUnit: ..., _: ... }` is fine, but one with `{ CompilationUnit: ... }` (no default) will throw at runtime if any other node kind is encountered. `NodeSchema.checkCompleteness()` exists but is never called.

2. **No typo detection at build time.** Writing `{ CompliationUnit: ... }` (typo) silently becomes dead code — the default `_` handles everything, or a runtime error fires on the real `CompilationUnit`.

3. **No type narrowing in equations.** The callback receives `KSNode` (the full union), forcing manual casting like `const cu = node as KSTypeAliasDeclaration`. The `ProductionEquations<N, V>` type in spec.ts COULD provide narrowing, but equations are typed as `unknown` so it's never used.

4. **No structural awareness.** An equation for `VariableDeclaration` that accesses `node.name` gets no type help — it doesn't know `name` is a `ChildSpec<KSIdentifier>`. The schema has this information but it's not surfaced.

5. **Inherited attribute equations can't express "from parent of kind X".** The `inh` equation signature is `(parent, child, idx) => V | undefined`, with no dispatch on parent kind.

### The `ProductionEquations` type exists but is unused

`spec.ts` defines:

```typescript
type ProductionEquations<N extends object, V> =
  & { [K in KindValues<N>]?: (node: Extract<N, { kind: K }>) => V }
  & { _?: (node: N) => V };
```

This WOULD provide compile-time checking and narrowing if `equations` were typed as `Record<string, ProductionEquations<N, V> | ((node: N) => V)>` instead of `Record<string, unknown>`. But it's not — probably because the value type `V` differs per attribute, making a single Record type impossible.

---

## The Boundary Confusion

### ast-schema/builder.ts vs libs/ag-schema/define.ts

Both define `child()`, `optChild()`, `list()`, `prop()` — but they are completely different types:

| | ast-schema/builder.ts | libs/ag-schema/define.ts |
|---|---|---|
| `child()` | `{ tag: 'child', typeRef: string }` | `{ __tag: 'child', __phantom?: T }` |
| Purpose | Codegen registry entry | Runtime + type-level phantom |
| When used | Schema declaration time | Generated output / runtime |

The ast-schema builder fills a global registry during `schema.ts` evaluation. The codegen script reads that registry and **generates code that calls ag-schema's** `defineNode()`. So ag-schema's functions are only used in generated code, never by humans directly.

### libs/ag-schema: Middle layer with unclear purpose

ag-schema provides:
- `defineNode()` / `defineLeaf()` — runtime NodeDef with child/prop field lists
- `createNodeSchema()` — NodeSchema with `getChildren` and `checkCompleteness`
- `InferNode<>` — type-level node type inference from definitions

But since ast-schema's codegen already generates:
- TypeScript interfaces directly (in `node-types.ts`)
- The `getChildren` function (in `node-schema.ts`)
- Builder functions (in `builders.ts`)

...the question is: what value does the ag-schema runtime layer add over just inlining the logic in codegen? The answer is `checkCompleteness()` — but it's never called.

---

## Options

### Option 1: Wire `NodeSchema` into `createSemantics()` (incremental)

Add an optional schema parameter to `createSemantics()`:

```typescript
function createSemantics<N>(grammar: Grammar<N>, specs: SpecInput<N>[], schema?: NodeSchema<N>)
```

During compilation, if a schema is provided and an equation is a production map:
- Call `schema.checkCompleteness(equations)` and warn/error on missing kinds
- Detect equation keys that don't match any schema kind (typo detection)

**Pros:** Minimal change, no breaking API changes, immediately useful.
**Cons:** Still runtime-only checking. No compile-time type narrowing.

### Option 2: Codegen generates typed equation interfaces

Have ast-schema codegen produce a typed `EquationMap` interface:

```typescript
// Generated
interface KSProductionEquations<V> {
  Program?: (node: KSProgram) => V;
  CompilationUnit?: (node: KSCompilationUnit) => V;
  TypeAliasDeclaration?: (node: KSTypeAliasDeclaration) => V;
  // ... all 360 kinds ...
  _?: (node: KSNode) => V;
}
```

Then SpecInput could be parameterized to use it:

```typescript
interface SpecInput<N, EqMap, R> {
  equations: { [attr: string]: ((node: N) => any) | EqMap };
}
```

**Pros:** Full compile-time checking — typos caught, node types narrowed, completeness enforceable.
**Cons:** Requires SpecInput API change. The per-attribute value type `V` still can't be enforced uniformly in a single Record.

### Option 3: Codegen generates AG spec skeletons

Instead of just types, generate typed spec builder functions:

```typescript
// Generated
function defineKSSpec<R>(config: {
  name: string;
  declarations: Record<string, AttrDecl>;
  equations: {
    [attr: string]: KSProductionEquations<any> | ((node: KSNode) => any);
  };
  project?: (root: KSNode) => R;
}): SpecInput<KSNode, R> { ... }
```

Or generate per-attribute typed equation builders:

```typescript
// Generated helper for production equations
function productionEq<V>(map: KSProductionEquations<V>): (node: KSNode) => V { ... }
```

**Pros:** Spec authors get type-safe helpers without changing the core AG library.
**Cons:** Another generated file, indirection.

### Option 4: Merge ag-schema into ast-schema, simplify

ag-schema's current role is: (a) runtime NodeDef objects with `childFields` lists, (b) `createNodeSchema` for `getChildren` + `checkCompleteness`, (c) `InferNode<>` type inference.

Since codegen already generates TypeScript interfaces directly (making `InferNode<>` redundant for the primary use case), and `getChildren` could be generated inline:

- Move `createNodeSchema` into ast-schema/codegen or inline the logic
- Remove libs/ag-schema as a separate package
- The codegen generates everything it needs directly

**Pros:** Removes a layer, simplifies mental model. One schema definition, one codegen, done.
**Cons:** Loses the "reusable schema library" abstraction if you ever have multiple grammars.

### Option 5: AG becomes schema-aware (deeper integration)

Make the AG library understand NodeSchema natively:

```typescript
function createGrammar<N>(schema: NodeSchema<N>): Grammar<N>
// Grammar now carries getChildren AND schema metadata

function createSemantics<N>(grammar: Grammar<N>, specs: SpecInput<N>[])
// Semantics uses grammar.schema to validate equations during compilation
```

In `compile.ts`, production equations are validated:
- Missing kinds → warning
- Unknown keys → error
- Inherited equations could dispatch on parent kind using schema knowledge

**Pros:** Deep integration, all validation happens in one place.
**Cons:** AG library is no longer AST-agnostic. May be over-coupling for a general library.

---

## Recommended Path

**Short term (Option 1 + 4):** Wire `NodeSchema` into `createSemantics` for runtime validation, and consider merging ag-schema into ast-schema since its separate existence adds confusion without clear value.

**Medium term (Option 2):** Have codegen generate a `KSProductionEquations<V>` type and a `KSInhEquation` type. Update `SpecInput` or create a `KSSpecInput` wrapper that uses these types. This gives compile-time checking where it matters most: production equation keys match real node kinds, and callback parameters are narrowed.

**Long term (Option 5, selective):** Rather than making AG fully schema-aware, create a thin `createSchemaGrammar(schema)` function that wraps `createGrammar` and passes the schema through to Semantics for validation. This keeps the core AG library generic while giving schema-aware users automatic checking.

### The key insight

The fundamental issue is not that AG "should" know about AST structure — it's that **production equations are the seam where tree structure meets attribute computation**, and that seam is currently untyped and unvalidated. Any solution that validates production equation keys against known node kinds (whether at compile time or semantics-creation time) addresses the core problem.

---

## Appendix: Current Data Flow Summary

```
Human writes:              ast-schema/schema.ts   (360 node kinds)
                                │
                           ast-schema/codegen.ts
                                │
Generates:                 ast-schema/generated/
                            ├── node-types.ts      (TS interfaces)
                            ├── node-defs.ts       (defineNode calls → uses ag-schema)
                            ├── node-schema.ts     (createNodeSchema → uses ag-schema)
                            ├── convert.ts         (TS → KS conversion)
                            ├── builders.ts        (factory functions)
                            └── serialize.ts       (JSON round-trip)

Human writes:              src/pipeline/binder.ts  (AG spec — hand-written equations)
                           src/pipeline/checker.ts (AG spec — hand-written equations)
                                │
                           src/program.ts
                            ├── getChildren        (from generated/node-schema.ts)
                            ├── createGrammar      (from libs/ag)
                            ├── createSemantics    (from libs/ag)
                            └── interpret          (from libs/ag)
```

The schema knowledge that exists in ast-schema (which kinds exist, what fields they have, what sum types they belong to) never reaches the AG specs or the AG library. The equations in binder.ts and checker.ts are written with string-literal kind names that are validated by nothing.
