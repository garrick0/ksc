# Option 5: fieldDefs-First Grammar Architecture

**Status**: Design document — implementation pending decision
**Scope**: Replaces the builder DSL with `as const` grammar definitions, enabling compile-time type derivation

---

## 1. The Problem

The current builder DSL is runtime-only (Maps, mutation, iteration). TypeScript cannot extract type-level information from it. This means:

- Equation keys (`{ CompilationUnit: fn }`) are `Record<string, Function>` — typos are silent
- `GrammarConfig.rootKind` is just `string`
- `Ctx.parentIs(kind)` is just `string`
- `fieldDefs` keys are `Record<string, ...>` — no literal type information

The builder provides DX features (sum type includes, field inheritance, `addFieldToSumTypeMembers`) but at the cost of being opaque to the type system.

## 2. The Idea

Define the grammar as `as const` objects. Derive all types from the values. The builder's DX features are reimplemented as pure functions that operate on the const objects, producing a new const object.

```
Current:  Builder (runtime) → build() → Maps → compile → generated types
Proposed: Const objects (value+type) → resolve() → Const objects → compile → generated types
                                         ↑ pure function
                                         ↓
                                    Types flow from const values
```

The key insight: `as const satisfies Schema` gives us both runtime values AND compile-time literal types from a single declaration.

## 3. What the Builder Currently Does

The builder provides 6 features:

| Feature | Usage | Complexity |
|---------|-------|------------|
| `node(kind, memberOf, fields)` | Register a node kind | Simple registration |
| `leaf(kind, ...memberOf)` | Register a leaf (no fields) | Sugar for `node(k, m, {})` |
| `sumType(name)` | Declare a sum type, returns name string | Simple registration |
| `sumTypeIncludes(A, B)` | A's members include B's members | Transitive closure |
| `addFieldToSumTypeMembers(st, field, desc)` | Add field to all members of a sum type | Deferred application |
| `addFieldToKinds(kinds, field, desc)` | Add field to specific kinds | Direct mutation |

Features 4-6 are the "builder DX" that a pure const object can't express directly. They need a resolution step.

## 4. Proposed Architecture

### 4.1 Grammar Definition Files

**`specs/<target>/grammar/grammar-def.ts`** — replaces `nodes.ts` + `spec.ts`:

```typescript
import type { GrammarDef, NodeDef, SumTypeDef } from '../../../grammar/def-types.js';
import { resolveGrammar } from '../../../grammar/resolve.js';

// ── Sum Types ──

const sumTypes = {
  Expression: { members: ['Identifier', 'BinaryExpression', ...] },
  Statement: { members: ['VariableStatement', 'ExpressionStatement', ...] },
  TypeNode: { members: ['TypeReference', 'UnionType', ...] },
  // ...
} as const satisfies Record<string, SumTypeDef>;

// ── Nodes ──

const nodes = {
  CompilationUnit: {
    fields: {
      fileName: { tag: 'prop', propType: 'string' },
      statements: { tag: 'list', typeRef: 'Statement' },
    },
  },
  Identifier: {
    memberOf: ['Expression', 'BindingName', 'EntityName'],
    fields: {
      escapedText: { tag: 'prop', propType: 'string' },
      // ...
    },
  },
  // ... 362 more nodes
} as const satisfies Record<string, NodeDef>;

// ── Sum Type Includes ──

const includes = {
  ForInitializer: ['Expression'],    // ForInitializer includes all Expression members
  ConciseBody: ['Expression'],
} as const satisfies Record<string, readonly string[]>;

// ── Field Augmentations ──

const fieldAugmentations = {
  sumTypeFields: {
    Expression: {
      typeString: { tag: 'prop', propType: 'string' },
    },
  },
  kindFields: {
    VariableDeclaration: {
      typeString: { tag: 'prop', propType: 'string' },
    },
    // ... other specific kinds
  },
} as const;

// ── Resolved grammar (pure function, const-preserving) ──

export const grammar = resolveGrammar({ nodes, sumTypes, includes, fieldAugmentations });

// ── Derived types (available at compile time!) ──

export type TSKind = keyof typeof grammar.nodes;
export type TSSumType = keyof typeof grammar.sumTypes;
```

### 4.2 Type Definition Files

**`grammar/def-types.ts`** — the schema types:

```typescript
// Field descriptors (same as current builder.ts, but as plain types)

export interface ChildField { tag: 'child'; typeRef?: string; }
export interface OptChildField { tag: 'optChild'; typeRef?: string; }
export interface ListField { tag: 'list'; typeRef?: string; }
export interface PropField { tag: 'prop'; propType: string; }
export type FieldDesc = ChildField | OptChildField | ListField | PropField;

// Node definition (input — before resolution)

export interface NodeDef {
  memberOf?: readonly string[];
  fields?: Record<string, FieldDesc>;
}

// Sum type definition (input — before resolution)

export interface SumTypeDef {
  members: readonly string[];
}

// Grammar definition (input to resolve)

export interface GrammarInput<
  N extends Record<string, NodeDef> = Record<string, NodeDef>,
  S extends Record<string, SumTypeDef> = Record<string, SumTypeDef>,
> {
  nodes: N;
  sumTypes: S;
  includes?: Record<string, readonly string[]>;
  fieldAugmentations?: {
    sumTypeFields?: Record<string, Record<string, FieldDesc>>;
    kindFields?: Record<string, Record<string, FieldDesc>>;
  };
}
```

### 4.3 Resolution Function

**`grammar/resolve.ts`** — replaces `builder.ts`:

```typescript
import type { GrammarInput, NodeDef, SumTypeDef, FieldDesc } from './def-types.js';
import type { NodeEntry, SumTypeEntry } from './builder.js';  // reuse existing types
import type { GrammarSpec } from './types.js';

/**
 * Resolve a raw grammar definition into a GrammarSpec.
 *
 * 1. Apply sum type includes (transitive closure)
 * 2. Apply field augmentations (sum type fields → members, kind fields)
 * 3. Compute memberOf from sum type membership
 * 4. Return GrammarSpec (same shape as builder.build() output)
 */
export function resolveGrammar(input: GrammarInput): GrammarSpec {
  // ... implementation
}
```

## 5. Key Design Decisions

### Decision 1: Where do `memberOf` declarations live?

**Option A: On the node definition** (current builder pattern):
```typescript
Identifier: {
  memberOf: ['Expression', 'BindingName', 'EntityName', ...],
  fields: { escapedText: { tag: 'prop', propType: 'string' } },
}
```
- Pro: Node is self-contained, easy to see what a node belongs to
- Con: Redundant — sum type also lists its members. 8 sum types for Identifier is verbose.

**Option B: On the sum type definition only** (inverse):
```typescript
// Sum type:
Expression: { members: ['Identifier', 'BinaryExpression', ...] }
// Node:
Identifier: { fields: { ... } }   // no memberOf
```
- Pro: Less redundant, clearer "groups" view
- Con: Need to scan all sum types to find which a node belongs to

**Option C: Both** — redundant, resolved with validation:
```typescript
// Both declared, resolve() validates consistency
```
- Pro: Maximum clarity, catches drift
- Con: Double-entry bookkeeping with 364 nodes and ~35 sum types

**Recommendation**: **Option B** — membership is a property of the sum type, not the node. The current builder already works this way internally (sumType stores members). The `memberOf` on NodeEntry is derived. This eliminates the most verbose part of node declarations (Identifier has 17 `memberOf` entries currently).

### Decision 2: How to handle `sumTypeIncludes` (transitive includes)?

**Option A: Explicit `includes` section** (shown in 4.1):
```typescript
const includes = {
  ForInitializer: ['Expression'],  // all Expression members are also ForInitializer members
} as const;
```
- Pro: Clear, separate from the core declarations
- Con: Extra declaration section

**Option B: Inline on the sum type**:
```typescript
ForInitializer: { members: ['VariableDeclarationList'], includes: ['Expression'] }
```
- Pro: All sum type info in one place
- Con: SumTypeDef becomes more complex

**Option C: Compute from member overlap**:
- No explicit includes — just list all members directly
- Pro: Simpler model
- Con: For `ForInitializer` = all `Expression` members + `VariableDeclarationList`, that's ~80 entries to maintain manually

**Recommendation**: **Option B** — keeps all sum type info together, and the resolution function already handles transitive closure.

### Decision 3: How to handle `addFieldToSumTypeMembers` / `addFieldToKinds`?

These are the deferred mutation operations. In the builder, they're called after all nodes are registered. In the const model, they need a different representation.

**Option A: Separate `fieldAugmentations` section** (shown in 4.1):
```typescript
fieldAugmentations: {
  sumTypeFields: {
    Expression: { typeString: { tag: 'prop', propType: 'string' } },
  },
  kindFields: {
    VariableDeclaration: { typeString: { tag: 'prop', propType: 'string' } },
  },
}
```
- Pro: Clear separation of "base fields" vs "augmented fields"
- Con: Fields for a node are split across two locations

**Option B: Just put the fields directly on each node**:
```typescript
Identifier: {
  fields: {
    escapedText: { tag: 'prop', propType: 'string' },
    typeString: { tag: 'prop', propType: 'string' },  // manually added
  },
}
```
- Pro: Everything about a node is in one place
- Con: `typeString` is on ~80 Expression members + 10 declaration kinds — that's 90 repetitions. Very error-prone.

**Option C: Spread pattern**:
```typescript
const expressionExtraFields = {
  typeString: { tag: 'prop' as const, propType: 'string' },
};

Identifier: {
  fields: { escapedText: ..., ...expressionExtraFields },
}
```
- Pro: Single definition, no resolution needed
- Con: Must remember to spread into every Expression member. Breaks `as const`.

**Recommendation**: **Option A** — field augmentations are a cross-cutting concern. Keeping them separate matches their semantics. The resolution function merges them into the final node definitions.

### Decision 4: How deep should the `as const` typing go?

**Option A: Top-level keys only** — kind names carry literal types, but field details are widened:
```typescript
const nodes = { ... } as const satisfies Record<string, NodeDef>;
// typeof nodes = { CompilationUnit: ..., Identifier: ..., ... }
// Keys are literal types, values are NodeDef
```
- Pro: Fast type checking, `keyof typeof nodes` gives you the kind union
- Con: Field-level type info is lost

**Option B: Full `as const`** — every field descriptor carries literal types:
```typescript
const nodes = { ... } as const;
// Every tag: 'child', typeRef: 'Expression', propType: 'string' is a literal type
```
- Pro: Maximum type information, could derive interfaces from field defs
- Con: 1,489 lines → massive type object. TypeScript may slow significantly with 364 entries. `as const` without `satisfies` loses validation.

**Option C: `as const satisfies` (full)**:
```typescript
const nodes = { ... } as const satisfies Record<string, NodeDef>;
```
- Pro: Literal types preserved AND validated against schema
- Con: TypeScript performance with 364 deeply-nested const entries is unknown. May hit type instantiation limits.

**Recommendation**: **Option A** — we primarily need kind names as literal types. Field-level type information is already well-served by the generated `KindToNode` type map. Going deeper risks TypeScript performance issues with no clear benefit. If field-level types prove valuable later, the path from A→C is straightforward.

### Decision 5: How does `convertGenerator` fit in?

The convert generator needs the same data it has today: `nodes`, `sumTypes`, `fieldExtractors`, `skipConvert`, `jsDocMembers`.

**Option A: Grammar definition includes convert data**:
```typescript
export const grammar = resolveGrammar({
  nodes, sumTypes, includes, fieldAugmentations,
  convert: {
    extractors: EXTRACTOR_CONFIG,
    skipConvert: new Set(['CompilationUnit']),
  },
});
```
- Pro: Everything in one place
- Con: Convert data is spec-specific, not grammar-structural. Violates current separation.

**Option B: Keep convert data separate** (like today):
```typescript
// grammar-def.ts exports the grammar
export const grammar = resolveGrammar({ nodes, sumTypes, ... });
export type TSKind = keyof typeof grammar.nodes;

// spec.ts assembles the full GrammarSpec, adding convertGenerator
export function buildGrammarSpec(): GrammarSpec {
  return {
    ...grammar,  // or adapt to GrammarSpec shape
    convertGenerator: () => generateTsConvert({ ... }),
  };
}
```
- Pro: Clean separation, grammar definition is pure data
- Con: Two-step assembly

**Recommendation**: **Option B** — the grammar definition should be pure structural data. Convert generation is a concern of the composition root, not the grammar definition.

### Decision 6: How does the analysis spec consume the kind type?

This is the payoff. Once `TSKind` is available as a compile-time type:

**Option A: Generic `AttrDecl<K>`**:
```typescript
interface SynAttr<K extends string = string> extends AttrBase {
  direction: 'syn';
  default: AttrExpr;
  equations?: Partial<Record<K, Function>>;
}

// Usage:
const allAttrs: AttrDecl<TSKind>[] = [
  {
    name: 'kindDefs',
    direction: 'syn',
    type: 'KindDefinition[]',
    default: eq_kindDefs_default,
    equations: { CompilationUnit: eq_kindDefs_CompilationUnit },  // ← type-checked!
  },
];
```
- Pro: Equation keys are validated at compile time
- Con: All generic machinery (AttrDecl, AnalysisSpec) needs the type parameter

**Option B: `satisfies` at the use site**:
```typescript
equations: {
  CompilationUnit: eq_kindDefs_CompilationUnit,
} satisfies Partial<Record<TSKind, Function>>,
```
- Pro: No changes to AttrDecl types, validation is local
- Con: Must remember to add `satisfies` everywhere, inconsistent

**Option C: Typed `GrammarConfig`**:
```typescript
interface GrammarConfig<K extends string = string> {
  rootKind: K;
  fileNameField: string;
}
// Just type-check the config, leave equation keys as-is for now
```
- Pro: Minimal change, catches the most dangerous typo (rootKind)
- Con: Doesn't catch equation key typos

**Recommendation**: **Option A** — the generic parameter threads naturally. `AttrDecl<K>`, `AnalysisSpec<K>`, `SynAttr<K>`, `InhAttr<K>`. The default `K = string` means no breaking changes to `analysis/compile.ts` or the mock spec.

## 6. What We Lose (Builder DX)

The builder provides an ergonomic imperative API. With const objects:

| Builder Feature | Const Equivalent | Ergonomics Impact |
|-----------------|------------------|-------------------|
| `b.sumType('Expr')` returns string var | `const Expression = 'Expression'` constant | Slightly more verbose |
| `b.node('Id', [Expr], { ... })` | `Id: { fields: { ... } }` + separate sum type membership | Membership not co-located |
| `b.leaf('Empty', Stmt)` | `Empty: {}` + sum type membership | Same |
| `b.sumTypeIncludes(A, B)` | `includes: { A: ['B'] }` | Same |
| `b.addFieldToSumTypeMembers(...)` | `fieldAugmentations.sumTypeFields[...]` | Same |
| `b.addFieldToKinds(...)` | `fieldAugmentations.kindFields[...]` | Same |
| `b.resolveIncludes()` | Automatic in `resolveGrammar()` | Better (no manual call) |

**Main ergonomic loss**: The builder lets you use variables for sum type names (`const Expr = b.sumType('Expression')`) and pass them to `node()` and `child()`. With const objects, you write strings everywhere. But the strings are now type-checked via `as const`, so the typo-safety is actually better.

## 7. File Size Impact

Current `nodes.ts`: 1,489 lines (imperative builder calls).

Estimated `grammar-def.ts` with Option B for Decision 1 (membership on sum types):

- Sum types (~35): ~200 lines (name + members array each)
- Nodes (~364): ~900 lines (just kind + fields, no memberOf)
- Includes: ~10 lines
- Field augmentations: ~30 lines
- Boilerplate: ~20 lines
- **Total: ~1,160 lines** — slightly smaller than current

With Option A for Decision 1 (membership on nodes): ~1,500 lines — about the same.

## 8. Migration Path

### Phase 1: Add `resolveGrammar` alongside builder

1. Create `grammar/def-types.ts` with the schema types
2. Create `grammar/resolve.ts` that takes a `GrammarInput` and returns `GrammarSpec`
3. Write tests validating `resolveGrammar` output matches `builder.build()` output for mock grammar

### Phase 2: Convert mock grammar first

1. Create `specs/mock/grammar/grammar-def.ts` as a const object
2. Update `specs/mock/grammar/spec.ts` to use `resolveGrammar` instead of builder
3. Verify all mock tests still pass
4. Export `type MockKind` from the grammar def

### Phase 3: Convert TS AST grammar

1. Write a script that reads `nodes.ts` and emits `grammar-def.ts` (mechanical conversion)
2. Create `specs/ts-ast/grammar/grammar-def.ts`
3. Update `specs/ts-ast/grammar/spec.ts`
4. Verify all tests pass
5. Export `type TSKind` from the grammar def

### Phase 4: Add kind type-safety to analysis

1. Make `AttrDecl` generic over `K extends string`
2. Update `specs/ts-ast/kind-checking/spec.ts` to use `AttrDecl<TSKind>`
3. Verify that equation keys are now type-checked
4. Update `GrammarConfig` to use `K` for `rootKind`

### Phase 5: Cleanup

1. Delete `grammar/builder.ts` (or keep as compatibility layer)
2. Update CLAUDE.md
3. Update tests

## 9. TypeScript Performance Concerns

The biggest risk is TypeScript type-checking performance with `as const` on a 364-entry object.

**Mitigation**: Decision 4, Option A — only top-level keys carry literal types. The inner field descriptors are widened to `FieldDesc`. This means TypeScript tracks 364 literal keys (one type per entry) rather than ~2,000 deeply-nested const types.

**Worst case**: If even 364 top-level keys are slow, we can split into multiple objects and merge:
```typescript
const expressionNodes = { ... } as const satisfies Record<string, NodeDef>;
const statementNodes = { ... } as const satisfies Record<string, NodeDef>;
const nodes = { ...expressionNodes, ...statementNodes, ... };
```

**Benchmark before committing**: After Phase 2 (mock grammar), measure `tsc` time on a no-op change to gauge the impact before tackling the full 364-node grammar.

## 10. What This Enables

Once kind names are compile-time types:

1. **Type-safe equation keys**: `equations: { CompilationUnit: fn }` is validated
2. **Type-safe `rootKind`**: `grammarConfig: { rootKind: 'CompilationUnit' }` is validated
3. **Type-safe `Ctx.parentIs`**: Could become `parentIs(kind: TSKind)` (requires generated evaluator to use the type)
4. **Exhaustiveness checking**: `switch (node.kind) { ... }` can be checked for exhaustiveness
5. **Refactoring safety**: Renaming a kind in the grammar def propagates type errors to all usages
6. **IDE support**: Autocomplete for kind names in equation keys

## 11. Comparison with Option 1+3 (Alternative)

Option 1+3 (import `KSKind` from generated output) achieves items 1-6 above with much less work:
- Change 1 line in `compileGrammar` (fieldDefs typing)
- Add generic parameter to `AttrDecl`
- Import `KSKind` from `generated/ts-ast/grammar/schema.js`

**The tradeoff**:
- Option 1+3: Types come from generated output (committed, stable). Minimal effort. Analysis imports from `generated/`.
- Option 5: Types come from the grammar definition itself. More architectural. Analysis imports from `specs/`.

**Option 5 is better when**: You want types to flow from the source definition, not from generated output. You want to eliminate the builder abstraction. You value that the grammar definition is both the runtime value and the type source.

**Option 1+3 is better when**: You want minimal disruption. The generated output is committed and stable. The builder DX is valued. You don't want to risk TypeScript performance issues.

## 12. Summary of Recommended Decisions

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| 1: memberOf location | On sum types (Option B) | Less redundant, clearer grouping |
| 2: sumTypeIncludes | Inline on sum type (Option B) | All sum type info in one place |
| 3: Field augmentations | Separate section (Option A) | Cross-cutting concerns belong separate |
| 4: `as const` depth | Top-level keys only (Option A) | Performance safety, field types from generated code |
| 5: Convert generator | Separate assembly (Option B) | Clean separation of concerns |
| 6: Analysis consumption | Generic `AttrDecl<K>` (Option A) | Natural threading, backward compatible |
