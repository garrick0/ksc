# Plan: Eliminate Grammar Codegen (Sub-option B)

## Goal

Remove ALL grammar code generation. The only codegen that remains is analysis
(Functor 2: `analysis/compile.ts` → `generated/ts-ast/kind-checking/`).

Replace `generated/ts-ast/grammar/` (4 generated files) with:
- **Type-level derivation** from `as const satisfies` schema (no codegen for types)
- **Hand-written convert.ts** (schema-driven generic converter + custom extractors)
- **Pure utility functions** for runtime metadata (no generated schema.ts)

## Architecture After

```
Layer 1: SCHEMA (as const satisfies, source of truth)
  specs/ts-ast/grammar/nodes.ts     — NODES + SUM_TYPES (plain objects, no builder)
  specs/mock/grammar/nodes.ts       — same pattern

Layer 2: DERIVATION (compile-time types + runtime utilities)
  grammar/derive.ts                 — DeriveNode<K>, PropTypeMap, KSNode union, KindToNode
  grammar/schema-utils.ts           — pure fns: computeFieldDefs(), computeMembership(), etc.

Layer 3: FRONTEND (hand-written, schema-driven)
  specs/ts-ast/frontend/convert.ts  — generic converter + custom extractors (NOT generated)
  specs/ts-ast/frontend/helpers.ts  — TS-specific helpers (unchanged)
  specs/ts-ast/frontend/extractors.ts — custom extractor data (unchanged)

Layer 4: ANALYSIS CODEGEN (the only codegen)
  analysis/compile.ts               — generates evaluator + attr-types
  generated/ts-ast/kind-checking/   — evaluator.ts, attr-types.ts
```

## What Gets Deleted

| File/Dir | Reason |
|----------|--------|
| `grammar/builder.ts` | Replaced by plain `as const satisfies` objects |
| `grammar/compile.ts` | Functor 1 eliminated entirely |
| `grammar/frontend/codegen.ts` | Converter generation replaced by hand-written convert.ts |
| `app/grammar-codegen/` (entire dir) | No grammar codegen pipeline needed |
| `specs/shared/ts-frontend-skeleton.ts` | Infrastructure now lives in hand-written convert.ts |
| `specs/ts-ast/grammar/spec.ts` | No grammar spec factory needed |
| `specs/ts-ast/frontend/generator.ts` | No convert.ts generator needed |
| `specs/mock/grammar/spec.ts` | Same |
| `specs/mock/frontend/generator.ts` | Same |
| `generated/ts-ast/grammar/` (4 files) | No longer generated — replaced by derive.ts + schema-utils.ts + convert.ts |

## What Gets Created

| File | Purpose |
|------|---------|
| `grammar/derive.ts` | Mapped types: DeriveNode, PropTypeMap, KSNode, KindToNode, sum type unions |
| `grammar/schema-utils.ts` | Pure functions: computeFieldDefs(), getChildren(), createNode(), computeMembership(), serialization |
| `specs/ts-ast/frontend/convert.ts` | Hand-written schema-driven converter (replaces generated convert.ts) |

## What Gets Modified

| File | Change |
|------|--------|
| `specs/ts-ast/grammar/nodes.ts` | Remove builder imports, use plain objects with `as const satisfies` |
| `specs/mock/grammar/nodes.ts` | Same |
| `analysis/compile.ts` | Update evaluator imports (fieldDefs → schema-utils, types → derive.ts) |
| `analysis/ctx.ts` | Import ASTNode from grammar/derive.ts instead of grammar/types.ts |
| `grammar/types.ts` | Remove builder imports; keep ASTNode, FieldDef; remove GrammarSpec, CompiledGrammar, etc. |
| `grammar/index.ts` | Re-export from derive.ts + schema-utils.ts instead of builder/compile |
| `app/analysis-codegen/ts-kind-checking.ts` | Update grammarImportPath |
| `app/analysis-codegen/mock.ts` | Update grammarImportPath |
| `app/user-api/lib/program.ts` | Import from hand-written convert.ts |
| `app/user-api/lib/parse.ts` | Import from hand-written convert.ts |
| `app/user-api/lib/export.ts` | Import from schema-utils + derive.ts instead of generated |
| `specs/ts-ast/kind-checking/equations.ts` | Import KS* types from derive.ts instead of generated |
| `specs/ts-ast/kind-checking/spec.ts` | Minor import updates if needed |
| `specs/mock/mock-analysis/spec.ts` | Minor import updates |
| `package.json` | Update codegen scripts |
| `CLAUDE.md` | Update architecture docs |
| All test files importing from generated/ts-ast/grammar/ | Update imports |

---

## Implementation Steps

### Phase 1: Create new infrastructure (additive, no breakage)
- [x] Step 1.1: Create `grammar/derive.ts` with mapped types
- [x] Step 1.2: Create `grammar/schema-utils.ts` with pure utility functions
- [x] Step 1.3: Create `specs/ts-ast/frontend/convert.ts` (hand-written converter)

### Phase 2: Update nodes.ts to plain objects
- [x] Step 2.1: Update `specs/ts-ast/grammar/nodes.ts` — remove builder imports, use plain objects
- [x] Step 2.2: Update `specs/mock/grammar/nodes.ts` — same

### Phase 3: Rewire imports (consumers → new infrastructure)
- [x] Step 3.1: Update `grammar/types.ts` — remove builder dep, keep shared contracts
- [x] Step 3.2: Update `grammar/index.ts` — re-export from derive.ts + schema-utils.ts
- [x] Step 3.3: Update `analysis/ctx.ts` — ASTNode import
- [x] Step 3.4: Update `analysis/compile.ts` — evaluator template imports
- [x] Step 3.5: Update `app/analysis-codegen/` — grammarImportPath
- [x] Step 3.6: Update `app/user-api/` — all lib files
- [x] Step 3.7: Update `specs/ts-ast/kind-checking/equations.ts` — KS* type imports
- [x] Step 3.8: Update all test files

### Phase 4: Delete old infrastructure
- [x] Step 4.1: Delete files listed in "What Gets Deleted"
- [x] Step 4.2: Update `package.json` codegen scripts

### Phase 5: Verify
- [x] Step 5.1: Run typecheck (`npm run typecheck`) — 0 errors
- [x] Step 5.2: Run codegen (`npm run codegen`) — evaluator regenerated successfully
- [x] Step 5.3: Run tests (`npx vitest run`) — 299/299 passing
- [x] Step 5.4: Update CLAUDE.md and memory

### Additional fixes during Phase 5
- Fixed `analysis/compile.ts` emitExpr: `this as KindCtx<...>` → `this as unknown as KindCtx<...>` (double cast needed with index signatures)
- Fixed `specs/ts-ast/kind-checking/equations.ts` line 113 cast: `as { ... }` → `as unknown as { ... }`
- Added `[key: string]: unknown` index signature to `KSNodeBase` for structural cast compatibility
- Fixed `specs/ts-ast/grammar/index.ts` to export propagated `NODES` (sum type fields distributed)
- Updated `specs/ts-ast/frontend/convert.ts` to use propagated NODES from barrel (fixes 1100 missing `typeString` errors)
- Updated `test/grammar-coverage.test.ts` to use `NODES` directly instead of deleted `buildGrammarSpec`
- Updated `test/compile-analysis.test.ts` to expect `as unknown as KindCtx` cast pattern

---

## Detailed Design Notes

### grammar/derive.ts — Type-level derivation

```typescript
// PropTypeMap: maps prop type strings → TS types
type PropTypeMap = {
  string: string;
  boolean: boolean;
  number: number;
  'readonly number[]': readonly number[];
  // ... union types
};

// Field type resolution
type ResolveField<F, Nodes, SumTypes> =
  F extends { tag: 'child'; typeRef: infer R } ? DeriveNode<R, Nodes, SumTypes> :
  F extends { tag: 'optChild'; typeRef: infer R } ? DeriveNode<R, Nodes, SumTypes> | undefined :
  F extends { tag: 'list'; typeRef: infer R } ? DeriveNode<R, Nodes, SumTypes>[] :
  F extends { tag: 'prop'; propType: infer P } ? P extends keyof PropTypeMap ? PropTypeMap[P] : never :
  never;

// DeriveNode: schema entry → TypeScript interface
type DeriveNode<K, Nodes, SumTypes> = { kind: K } & { ... fields };

// KSNode union, KindToNode map
```

### grammar/schema-utils.ts — Runtime utilities

```typescript
// Pure functions, take schema as input
export function computeFieldDefs(nodes: NodesSchema): Record<string, FieldDef[]>;
export function computeAllKinds(nodes: NodesSchema): ReadonlySet<string>;
export function getChildren(node: ASTNode, fieldDefs: Record<string, FieldDef[]>): ASTNode[];
export function createNode(kind, fields, fieldDefs): ASTNode;
export function computeMembership(nodes, sumTypes): Record<string, string[]>;
// Serialization helpers
export function nodeToJSON(node, fieldDefs): JSONNode;
export function nodeFromJSON(data, fieldDefs): ASTNode;
```

### Generated evaluator changes

The generated evaluator currently imports:
```typescript
import type { KSNode, KindToNode } from '../grammar/index.js';
import { fieldDefs } from '../grammar/index.js';
```

After change, it will import from wherever grammar/index.ts re-exports to:
```typescript
import type { KSNode, KindToNode } from '../grammar/index.js';  // same path, re-exports from derive.ts
import { fieldDefs } from '../grammar/index.js';  // re-exports from schema-utils computed value
```

The grammarImportPath in analysis codegen just needs to point to the right barrel.
Since we keep `grammar/index.ts` as a barrel, the generated evaluator's import path
can stay the same — we just need grammar/index.ts to export the right things.

**Key insight**: The generated evaluator imports `fieldDefs` as a runtime value.
Currently it's a generated const in schema.ts. After this change, `grammar/index.ts`
will compute and export `fieldDefs` from `NODES` at module load time (via schema-utils).

But wait — the generated evaluator lives in `generated/ts-ast/kind-checking/` and
imports from `../grammar/index.js` — that's `generated/ts-ast/grammar/index.js`!
So we need either:
1. Keep `generated/ts-ast/grammar/index.ts` as a thin re-export barrel, OR
2. Change the grammarImportPath in analysis codegen

**Decision**: Option 2 — change grammarImportPath. The generated evaluator will
import directly from `grammar/index.js` (the source, not generated). This means
the grammarImportPath changes from `../grammar/index.js` to `../../../grammar/index.js`.

BUT — the evaluator also imports KSNode and KindToNode types. These currently come
from generated node-types.ts. After this change, they come from grammar/derive.ts
(re-exported via grammar/index.ts). The evaluator needs these types to be available
at the grammar/index.ts barrel.

**But there's a problem**: grammar/derive.ts derives types from a SPECIFIC schema
(specs/ts-ast/grammar/nodes.ts). The grammar/ directory is supposed to be generic.
We can't import from specs/ in grammar/.

**Solution**: grammar/derive.ts exports generic type utilities. The concrete types
(KSNode, KindToNode for the TS AST grammar) are computed in a spec-level barrel:
`specs/ts-ast/grammar/types.ts` (NEW). OR we use a different approach:

Actually, the evaluator needs concrete types like `KSNode` (the union of all 364
node kinds). This can't come from generic grammar/ machinery — it must be derived
from the specific schema.

**Revised approach**:
- `grammar/derive.ts` exports generic type-level utilities (DeriveNode, PropTypeMap)
- A spec-level file computes the concrete types and re-exports runtime utilities
- The analysis codegen grammarImportPath points to this spec-level barrel

Actually, let's keep it simpler. The grammar/index.ts barrel will:
1. Export generic types (ASTNode, FieldDef) from grammar/types.ts
2. Export generic mapped type utilities from grammar/derive.ts
3. NOT export concrete KSNode/KindToNode (those are spec-specific)

The concrete KSNode/KindToNode will be exported from `specs/ts-ast/grammar/index.ts`
(a new spec-level barrel). The analysis codegen grammarImportPath will point there.

Wait, but the grammar directory is "fully generic, zero TS-specific code."
The evaluator needs spec-specific types. So the evaluator should import from
a spec-level module, not from grammar/.

**Final decision**: Create `specs/ts-ast/grammar/index.ts` as the spec-level barrel
that applies the generic derive.ts utilities to the concrete NODES/SUM_TYPES schema.
The analysis codegen grammarImportPath points to this barrel.

For the mock grammar: same pattern with `specs/mock/grammar/index.ts`.

This keeps grammar/ fully generic and specs/ owns the concrete type derivation.
