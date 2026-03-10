# Attribute-Centric vs Kind-Centric Equation Organization

## The 2D Matrix

Every attribute grammar operates over a two-dimensional space: **(node kind) x (attribute)**. Each cell in this matrix is either an explicit equation or is covered by a default/propagation rule.

```
                   kindDefs    violationFor    defEnv       contextFor   ...
                   ────────    ────────────    ──────       ──────────
CompilationUnit    EXPLICIT    default(null)   root(Map)    root(null)
Identifier         default([]) EXPLICIT        copy-down    copy-down
VarDeclaration     default([]) default(null)   copy-down    EXPLICIT
CallExpression     default([]) EXPLICIT        copy-down    copy-down
...364 kinds...    default     default         copy-down    copy-down
```

The question — attr-centric vs kind-centric — is about how you *slice* this matrix for authoring, storage, and compilation. The matrix itself is invariant.

## What "Attr-Centric" Means Concretely

Each attribute is a self-contained declaration that carries its default and a sparse map of per-kind overrides:

```typescript
// AttrDecl — the attr IS the primary unit
{
  name: 'violationFor',
  direction: 'syn',
  type: 'Diagnostic | null',
  default: null,                          // covers all 364 kinds
  equations: {                            // sparse overrides (11 of 364)
    Identifier: eq_violationFor_Identifier,
    CallExpression: eq_violationFor_CallExpression,
    BinaryExpression: eq_violationFor_BinaryExpression,
    // ...8 more
  }
}
```

This is how KSC's `AnalysisSpec.attrs: AttrDecl[]` works. The compiler iterates attrs, generates one method per attr, and emits a `switch(node.kind)` for dispatch within each method.

**Coverage guarantee**: If an attr has a `default`, every kind is covered. If it doesn't, `equations` must be exhaustive (or the compiler validates this). No separate completeness check needed — it's structural.

## What "Kind-Centric" Means Concretely

Each production (node kind) declares all the attributes it overrides:

```typescript
// Per-kind object — the production IS the primary unit
const VariableDeclarationEquations = {
  kindAnnotations: eq_kindAnnotations_VariableDeclaration,
  contextFor: eq_contextOverride,
};

const IdentifierEquations = {
  violationFor: eq_violationFor_Identifier,
};
```

This is how KSC's `equations.ts` exports are structured. Each per-kind object groups all equation overrides for that production.

**Coverage guarantee**: Requires separate infrastructure — you need to know the full attribute set and which ones have defaults, then verify every non-default cell is covered. This is a validation-time check on the transposed matrix.

## What KSC Actually Does: A Hybrid

KSC uses both views, connected by `pivotToAttrCentric()`:

```
equations.ts                     spec.ts                          compile.ts
─────────────                    ───────                          ──────────
Individual eq functions    →     pivotToAttrCentric()       →     AttrDecl[]
  + per-kind groupings     →       reshapes to attr-centric →       per-attr methods
                                                                    with per-kind switch
```

1. **Authoring** (equations.ts): Functions defined individually (`eq_violationFor_Identifier`), then grouped kind-centric at the bottom (`IdentifierEquations = { violationFor: ... }`).
2. **Spec assembly** (spec.ts): `pivotToAttrCentric()` transposes the kind-centric objects into attr-centric `Record<attrName, Record<kind, fn>>`, then these are spread into `AttrDecl[]`.
3. **Compilation** (compile.ts): Consumes attr-centric `AttrDecl[]`. Generates one method per attr, each containing a `switch(this.node.kind)` with cases for overrides and a default fallthrough.

The pivot is 30 lines, O(K*A), preserves function references and `withDeps()` metadata. It's a pure data reshape with no semantic transformation.

## Silver's Model

In Silver (University of Minnesota's AG system), equations are written inside `production` or `aspect` blocks:

```silver
-- Silver syntax (illustrative)
aspect production compilationUnit
top.kindDefs = extractDefs(top);       -- one equation per (prod, attr) pair
end;

aspect production identifier
top.violationFor = checkViolation(top);
end;
```

Silver's **Modular Well-Definedness Analysis (MWDA)** validates that every (production, attribute) cell is covered — either by an explicit equation, a default, or a forwarding/propagation rule. This is a completeness check over the 2D matrix.

Key insight: **MWDA validates the matrix, not a particular layout of the matrix.** Silver's production-centric syntax is a language design choice, not a requirement of the underlying AG theory.

## Evaluation of the Two Axes

### Authoring Convenience

| Concern | Attr-centric | Kind-centric |
|---------|-------------|--------------|
| Adding a new attribute | Add one AttrDecl with default + overrides in one place | Must touch every kind that needs an override |
| Adding a new kind that overrides N attrs | Touch N separate AttrDecl equations maps | Write one object with all N overrides |
| Seeing all equations for one attribute | Natural — it's the primary grouping | Must scan all kind objects |
| Seeing all equations for one kind | Must scan all attr declarations | Natural — it's the primary grouping |
| Defaults | Structural — the `default` field on AttrDecl | Must be reconstructed or managed separately |

**Verdict**: Neither dominates. Kind-centric is better for production-focused work (what does this kind compute?). Attr-centric is better for attribute-focused work (how does this attribute flow through the tree?). The current hybrid gives both.

### Type Safety

| Concern | Attr-centric | Kind-centric |
|---------|-------------|--------------|
| Equation signature correctness | `AttrDecl<K>` generic constrains equation types per direction | Per-kind record type must encode all attr signatures |
| Typo detection (kind names) | `equations?: Partial<Record<K, Function>>` catches invalid kinds at type level when K is a union | Keys of per-kind objects are kind names — naturally correct |
| Exhaustiveness | Default field handles it; no-default attrs can use required Record | Must verify every kind has entries for all required attrs |
| Per-kind node narrowing | `KindCtx<KSFoo>` cast in emitted code | Same — type narrowing is independent of organization |

**Verdict**: Roughly equivalent. Attr-centric has a slight edge because `default` structurally guarantees coverage, eliminating a class of errors that kind-centric must validate separately.

### Compilation

The compiler generates per-attr methods with per-kind switch dispatch regardless of input layout:

```typescript
// Generated evaluator (always this shape)
violationFor(property: string): Diagnostic | null {
  switch (this.node.kind) {
    case 'Identifier': return eq_violationFor_Identifier(this as KindCtx<...>, property);
    case 'CallExpression': return eq_violationFor_CallExpression(this as KindCtx<...>, property);
    // ...353 more kinds fall through to default
    default: return null;
  }
}
```

Both input layouts produce identical output. The compiler must iterate (attr, kind) pairs either way. **The compilation axis is genuinely orthogonal to the organization question.**

### Validation (MWDA-style)

Silver's completeness check verifies every cell in the matrix is covered. This can be done on either layout:

- **Attr-centric**: For each attr without a default, verify `equations` (or `parentEquations`) covers all kinds.
- **Kind-centric**: For each kind, verify all non-defaulted attrs have equations.

Both are O(K*A) scans of the same data. KSC's `compile.ts` already does variant (1) — it validates equation kind references against `allKinds` and checks for anonymous functions. Extending this to full MWDA (exhaustiveness for default-less attrs) would be straightforward from the attr-centric layout.

**Verdict**: Orthogonal. Validation checks the matrix, not the layout.

## Is the Distinction Arbitrary?

**No, but it's less consequential than it appears.** The distinction matters for two things:

1. **Authoring ergonomics** — which view does the spec author work with day-to-day?
2. **API surface** — what does `AnalysisSpec` expose to the compiler?

It does NOT matter for:
- Generated code (always per-attr methods with per-kind switch)
- Validation (always over the full matrix)
- Runtime performance (identical generated evaluator)
- Dependency tracking (withDeps is on individual functions, independent of grouping)

The pivot function makes the choice reversible and costless. You can author in whichever view is natural and reshape for whichever view the downstream consumer needs.

## Options

### Option 1: Keep the Hybrid (Current)

Author kind-centric in equations.ts, pivot to attr-centric for spec assembly.

**Pros**: Best of both views. Equations.ts reads naturally ("here's everything CompilationUnit computes"). AttrDecl reads naturally ("here's the violationFor attribute with its default and overrides"). Pivot is trivial.

**Cons**: Two representations of the same data. Reader must understand the pivot to trace the full flow.

### Option 2: Pure Attr-Centric (Remove Pivot)

Write equations directly in attr-centric format in spec.ts. No per-kind groupings in equations.ts.

```typescript
// equations.ts: just flat functions, no grouping
export const eq_violationFor_Identifier = withDeps([...], function eq_violationFor_Identifier(...) { ... });

// spec.ts: attr-centric directly
{
  name: 'violationFor',
  equations: {
    Identifier: eq_violationFor_Identifier,
    CallExpression: eq_violationFor_CallExpression,
    ...
  }
}
```

**Pros**: Simpler — one representation, no pivot. AttrDecl is the single source of truth.

**Cons**: Lose the kind-centric view. When you want to know "what does VariableDeclaration override?", you must scan all 8 attrs. As the number of attrs grows, this gets worse.

### Option 3: Pure Kind-Centric (Remove AttrDecl Equations)

Make `AnalysisSpec` accept kind-centric data. The compiler transposes internally.

```typescript
interface AnalysisSpec {
  attrDecls: AttrDeclBase[];           // name, direction, type, default — no equations
  overrides: Record<Kind, Record<AttrName, Function>>;  // kind-centric
}
```

**Pros**: Authoring is always production-centric. No pivot needed at the spec level.

**Cons**: Splits the attribute declaration in two — defaults/types in `attrDecls`, equations in `overrides`. Loses the self-contained AttrDecl unit. The compiler must merge them, which is a more complex pivot than the current one. Default handling becomes implicit rather than structural.

### Option 4: Dual-View with Type-Safe Records

Define a typed per-kind record type derived from the attr declarations, getting TypeScript to check both views:

```typescript
type AttrOverrideMap = {
  kindDefs?: (ctx: KindCtx<...>) => KindDefinition[];
  violationFor?: (ctx: KindCtx<...>, p: string) => Diagnostic | null;
  // ... all attrs with their signatures
};

// Per-kind objects are typed against AttrOverrideMap
const IdentifierEquations: AttrOverrideMap = {
  violationFor: eq_violationFor_Identifier,
};
```

**Pros**: TypeScript catches attribute name typos and signature mismatches in the kind-centric view. The pivot still produces attr-centric data for AttrDecl.

**Cons**: The `AttrOverrideMap` type must be manually maintained in sync with the attrs. Adds a type layer for a problem that `validateSpec` already catches at build time. The benefit is marginal given that function references already carry type information through `withDeps()`.

## Recommendation

**Option 1 (keep the hybrid) is the right choice for KSC's current scale.**

The pivot is 30 lines, zero-cost, and gives both views. The attr-centric AttrDecl is a clean, self-contained unit that the compiler consumes naturally. The kind-centric groupings in equations.ts are a readability convenience that costs nothing.

The only actionable improvement is extending validation (Option 2 from the conversation prompt's "what check are you missing?" section):

1. If an attr has no default, verify `equations` is exhaustive over `allKinds`
2. Verify equation kind references exist in `allKinds` (already done in `validateSpec`)
3. Verify equation function signatures (already done by TypeScript + `withDeps()`)

These are validation rules on the attr-centric data, not data layout changes. They would bring KSC's completeness checking to Silver MWDA parity without any restructuring.

## Summary Table

| Dimension | Attr-centric | Kind-centric | Hybrid (current) |
|-----------|-------------|--------------|-------------------|
| Authoring: add attr | One place | N places | One place (attr-centric side) |
| Authoring: add kind | N places | One place | One place (kind-centric side) |
| Default handling | Structural | Reconstructed | Structural (attr-centric side) |
| Completeness | Trivial with defaults | Requires validation | Trivial with defaults |
| Compilation | Natural | Requires transpose | Natural (attr-centric consumed) |
| Type safety | Good | Good | Good |
| Cognitive overhead | Medium | Medium | Low (each view is natural) |
| Code cost | Baseline | Baseline | +30 lines (pivot) |
