# KSC Architecture Review — Round 2

Date: 2026-03-09

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Import Discipline](#2-import-discipline)
3. [Type Safety](#3-type-safety)
4. [Separation of Concerns](#4-separation-of-concerns)
5. [Dead Code and Unused Contracts](#5-dead-code-and-unused-contracts)
6. [Evaluator Engine Design](#6-evaluator-engine-design)
7. [Codegen Correctness](#7-codegen-correctness)
8. [Test Suite](#8-test-suite)
9. [Filesystem Organization](#9-filesystem-organization)
10. [Recommendations](#10-recommendations)
11. [Implementation Progress](#11-implementation-progress)

---

## 1. Executive Summary

The round 1 review restructured the codebase into a cleaner ports-and-adapters
layout (split files, barrel imports, `as any` reduction, test directory hierarchy).
This follow-up review examines the codebase as it stands after those changes.

**Key findings:**

- **Import discipline is almost perfect.** There are exactly 5 barrel bypasses,
  all in `app/` and `generated/` files. No circular dependencies.
- **`EvaluationPipeline<I,R,P,O>` is dead** — defined, documented, re-exported
  from three barrels, but never implemented or consumed outside one composition root.
- **`KindScriptConfig` has three dead fields** (`include`, `exclude`, `strict`)
  that are never read anywhere.
- **Generated code bypasses barrels** for `Ctx` and `DispatchConfig` imports.
  The codegen in `compile.ts` hard-codes paths to internal files.
- **Two duplicate `ConvertContext` interfaces** exist in the frontend adapter
  (one in `convert.ts`, one in `helpers.ts`) with overlapping but incompatible shapes.
- **Test helpers are duplicated** across 6+ test files. No shared fixture cache
  or common helper module exists.
- **The `FieldDef.typeRef` field is semantically overloaded** — it means
  "referenced child kind" for child/list fields and "property type string" for
  prop fields, with no type-level distinction.

**Architecture health:** 9/10. Port boundaries are clean. The issues are
localized: dead contracts, a few barrel bypasses, duplicated helpers, and
type safety gaps in the frontend adapter.

---

## 2. Import Discipline

### 2.1 Barrel Bypasses (5 instances)

All internal imports from `app/` and `generated/` should go through barrels
(`grammar/index.js`, `analysis/index.js`, `evaluator/index.js`). Five do not:

| File | Import | Should Be |
|------|--------|-----------|
| `app/user-api/lib/program.ts:17` | `evaluator/types.js` | `evaluator/index.js` |
| `app/user-api/lib/program.ts:31` | `analysis/compile.js` | `analysis/index.js` |
| `app/analysis-codegen/lib/pipeline.ts:16-18` | `analysis/compile.js`, `analysis/validate.js`, `analysis/types.js` | `analysis/index.js` |
| `app/analysis-codegen/ts-kind-checking.ts:22` | `analysis/types.js` | `analysis/index.js` |
| `app/analysis-codegen/mock.ts:22` | `analysis/types.js` | `analysis/index.js` |

### 2.2 Generated Code Bypasses Barrels

The code generator (`analysis/compile.ts:301-302`) emits import paths directly to
internal files in generated dispatch code:

```typescript
// compile.ts:301 — generates this import in dispatch.ts:
import type { Ctx, KindCtx } from '${analysisImportPath}/ctx.js';
import type { DispatchConfig } from '${evaluatorImportPath}/types.js';
```

Both `Ctx`/`KindCtx` and `DispatchConfig` are exported from their respective
barrels. The generated imports should use `/index.js` instead.

### 2.3 Layer Violations

None found. Port modules have zero imports from `specs/` or `app/`.
The layering `grammar → analysis → evaluator` is strictly enforced.
No circular dependencies exist anywhere in the codebase.

### 2.4 Cross-Root Isolation

The three `app/` subdirectories are properly isolated:
- `app/cli/` → imports from `app/user-api/` only (correct dependency direction)
- `app/user-api/` → imports from ports + specs + generated only
- `app/analysis-codegen/` → imports from ports + specs only

---

## 3. Type Safety

### 3.1 Dual `ConvertContext` Interfaces

**Files:** `specs/ts-ast/frontend/convert.ts:32-36`, `specs/ts-ast/frontend/helpers.ts:19-22`

Two separate `ConvertContext` interfaces with overlapping but incompatible shapes:

```typescript
// convert.ts — internal, mutable
interface ConvertContext {
  checker: ts.TypeChecker | undefined;
  depth: AnalysisDepth;
  tsToKs: WeakMap<ts.Node, KSNode>;  // extra field
}

// helpers.ts — exported, readonly
export interface ConvertContext {
  readonly checker: ts.TypeChecker | undefined;
  readonly depth: AnalysisDepth;
}
```

Helpers functions accept the narrower type and work fine, but this is fragile.
Nothing prevents a helper from accidentally accessing `tsToKs` if the context
is widened. The relationship between these two interfaces is implicit.

### 3.2 `FieldExtractorFn` Uses `n: any`

**File:** `specs/ts-ast/frontend/convert.ts:99`

```typescript
type FieldExtractorFn = (ctx: ConvertContext, n: any, node: ts.Node, children: KSNode[]) => unknown;
```

The `n: any` parameter is passed to every custom field extractor. This means
100+ extractor functions have no type checking on their second parameter.
The `n` is always `node as any` (line 245), but using a more specific type
(e.g., `Record<string, unknown>` or a per-kind narrowing pattern) would catch
typos in field access.

### 3.3 `SyntaxKind` Double-Cast

**File:** `specs/ts-ast/frontend/convert.ts:73`

```typescript
const SK = ts.SyntaxKind as unknown as Record<string, number>;
```

This double-cast via `unknown` eliminates all type safety for enum access. It's
needed because the grammar iterates kinds by string name and looks them up in
the SyntaxKind enum dynamically. But it allows indexing with any string.

### 3.4 Comment Attachment Bypasses Readonly

**File:** `specs/ts-ast/frontend/convert.ts:56,59`

```typescript
(ksNode as any).leadingComments = leading.map(toCommentRange);
(ksNode as any).trailingComments = trailing.map(toCommentRange);
```

Uses `as any` to add properties post-construction on a nominally readonly node.
The `KSNodeBase` index signature is `readonly [key: string]: unknown`, so this
bypasses the immutability guarantee introduced in round 1.

### 3.5 `FieldDef.typeRef` Semantic Overload

**File:** `grammar/ports.ts:28`

```typescript
export interface FieldDef {
  name: string;
  tag: 'child' | 'optChild' | 'list' | 'prop';
  typeRef?: string;  // means child type ref OR prop type string
  default?: unknown;
}
```

When `tag === 'prop'`, `typeRef` is set to the TypeScript type string
(e.g., `'boolean'`, `'string'`). For other tags, it's the referenced child
kind. Consumers must check `tag` to interpret `typeRef`, but the type system
doesn't enforce this. A discriminated union would be more precise:

```typescript
type FieldDef =
  | { name: string; tag: 'child' | 'optChild' | 'list'; childKind?: string }
  | { name: string; tag: 'prop'; propType: string; default?: unknown };
```

### 3.6 `loadConfig` Returns Unvalidated `any`

**File:** `app/cli/cli.ts:100-103`

```typescript
async function loadConfig(configPath: string): Promise<KindScriptConfig> {
  const abs = path.resolve(configPath);
  const mod = await import(abs);
  return mod.default ?? mod;  // any → KindScriptConfig, no validation
}
```

Dynamic `import()` returns `any`. The function promises `KindScriptConfig` but
performs no runtime validation. A malformed config file will be accepted silently.

### 3.7 Dispatch Entry Signatures Use `any`

**File:** `evaluator/types.ts:26-42`

All dispatch entry function signatures use `any[]` args and `any` returns:

```typescript
compute: (ctx: Ctx, ...args: any[]) => any;     // SynDispatchEntry
computeRoot: (ctx: Ctx, ...args: any[]) => any;  // InhDispatchEntry
init: any;                                        // CollectionDispatchEntry
combine: (acc: any, contrib: any) => any;
```

This is the lowest layer of the evaluation pipeline and propagates `any`
through the entire attribute system. It's intentional (dispatch is dynamically
wired from generated code), but it means the evaluator engine has no type
safety internally — all safety comes from the `TypedAGNode<M>` wrapper at
the consumer boundary.

### 3.8 `Grammar<K>` Doesn't Connect K to `fieldDefs` Keys

**File:** `grammar/ports.ts:37-44`

```typescript
interface Grammar<K extends string = string> {
  readonly fieldDefs: Readonly<Record<string, readonly FieldDef[]>>;
  //                                 ^^^^^^ — not K
}
```

You can access `grammar.fieldDefs["NonExistentKind"]` without a type error.
The `allKinds: ReadonlySet<K>` provides runtime checking, but the type system
doesn't encode the invariant that `fieldDefs` keys match `K`.

### 3.9 `export.ts` Uses `as any` for Dynamic Field Access

**File:** `app/user-api/lib/export.ts:70,87`

```typescript
const val = (node as any)[def.name];
const v = (node as any)[def.name];
```

The `IndexedNode` pattern from `grammar/tree-ops.ts` (which uses
`ASTNode & { readonly [key: string]: unknown }`) isn't used here. Instead,
`as any` casts bypass all type checking for dynamic field access.

---

## 4. Separation of Concerns

### 4.1 Two Validation Functions in Different Modules

**Files:** `analysis/validate.ts:20`, `analysis/compile.ts:390`

Two separate validators with non-overlapping scope:

1. **`validateSpec(spec)`** — in `validate.ts`, exported, checks attribute
   dependency references exist. Called by codegen pipeline.
2. **`validateSpecConsistency(grammar, attrs)`** — in `compile.ts`, private,
   checks rootKind, equation kinds, function names, exhaustiveness. Called
   inside `compileAnalysis()`.

This means codegen roots call `validateSpec()` for dep checking, then
`compileAnalysis()` internally calls `validateSpecConsistency()` for
grammar-aware checking. There's no unified validation entry point.
A composition root using `wireEvaluator()` directly (without codegen) gets
neither check.

### 4.2 `buildDepGraph` and `buildDepGraphFromAttrs` Duplication

**File:** `analysis/compile.ts:104,114`

```typescript
export function buildDepGraph(attrs: AttrDecl[]): AttributeDepGraph { ... }
function buildDepGraphFromAttrs(attrs: AttrDecl[]): { edges, order } { ... }
```

`buildDepGraph` wraps `buildDepGraphFromAttrs` with extra formatting. Both are
called from `compileAnalysis()`: line 460 calls `buildDepGraphFromAttrs` (for
topo sort), line 471 calls `buildDepGraph` (for the result). This means the
dep graph is computed twice during compilation.

### 4.3 CLI Exports Test-Only Functions

**File:** `app/cli/cli.ts`

Five exports from the CLI entry point are only used by tests:

- `parseArgv()` (line 41) — argument parsing
- `findConfig()` (line 92) — config file discovery
- `findRootFiles()` (line 108) — TS file walker
- `EXIT_SUCCESS`, `EXIT_VIOLATIONS`, `EXIT_ERROR` (lines 26-28) — exit codes

These are test hooks, not public API. They couple test infrastructure to the
CLI module structure. A separate `cli/utils.ts` or `cli/internals.ts` would
make the boundary clearer.

### 4.4 `--depth` Validation Duplicated in Arg Parser

**File:** `app/cli/cli.ts:61-76`

The `--depth value` and `--depth=value` validation logic is duplicated:

```typescript
} else if (arg === '--depth' && i + 1 < args.length) {
  const val = args[++i];
  if (val === 'parse' || val === 'bind' || val === 'check') {
    depth = val;
  } else { ... }
} else if (arg.startsWith('--depth=')) {
  const val = arg.slice('--depth='.length);
  if (val === 'parse' || val === 'bind' || val === 'check') {  // same check
    depth = val;
  } else { ... }
}
```

The valid-value check appears twice. A helper function would eliminate the
duplication.

### 4.5 `export.ts` in Composition Root Imports Directly from Adapters

**File:** `app/user-api/lib/export.ts:8-10`

```typescript
import type { KSTree } from '../../../specs/ts-ast/frontend/convert.js';
import type { KSNode, KSCompilationUnit, KSIdentifier } from '../../../specs/ts-ast/grammar/index.js';
import { fieldDefs, sumTypeMembership } from '../../../specs/ts-ast/grammar/index.js';
```

This is the intended pattern (composition roots wire adapters), but `export.ts`
also uses `walkNode()` with hardcoded field-level access logic (lines 49-117).
This couples the dashboard export to the internal structure of the TS AST
grammar — it's essentially a second frontend that doesn't go through the
`Frontend` port.

---

## 5. Dead Code and Unused Contracts

### 5.1 `EvaluationPipeline<I,R,P,O>` — Defined But Never Truly Used

**Files:** `evaluator/types.ts:114-119`, `evaluator/index.ts:27`,
`ports.ts:88`, `app/user-api/lib/program.ts:17,44`

The `EvaluationPipeline` interface is:
- Defined in `evaluator/types.ts`
- Re-exported from `evaluator/index.ts`, `ports.ts`
- Documented in CLAUDE.md

But it's only used as a type annotation on one local variable:
```typescript
// program.ts:44
const pipeline: EvaluationPipeline<ts.Program, KSProgram, KSCProjections, AnalysisDepth> = { ... };
```

This variable is module-level and never returned or passed to any function
that demands `EvaluationPipeline`. The interface has no generic machinery that
consumes it. It's a documentation-only contract — removing it would change
nothing at runtime or at the type level.

### 5.2 `KindScriptConfig` Fields `include`, `exclude`, `strict` — Never Read

**File:** `app/user-api/lib/config.ts:15-20`

```typescript
export interface KindScriptConfig {
  readonly include?: string[];   // never read
  readonly exclude?: string[];   // never read
  readonly strict?: boolean;     // never read
  readonly analysisDepth?: 'parse' | 'bind' | 'check';  // actually used
}
```

Only `analysisDepth` is read (in `program.ts:74` and `cli.ts:151`). The other
three fields are defined in the API surface but have no implementation.
Users can set them and get no effect.

### 5.3 Grammar Factory Functions Unused Outside Modules

**Files:** `specs/ts-ast/grammar/index.ts:37-39`, `specs/mock/grammar/index.ts:23-26`

```typescript
export function createTSASTGrammar(): GrammarMetadata<typeof NODES_RAW> { ... }
export function createMockGrammar(): GrammarMetadata<typeof NODES> { ... }
```

Both are exported, but only called once at module load time within their own
modules. No test or consumer calls them externally.

### 5.4 `ValidationDiagnostic` Not Exported from Barrel

**File:** `analysis/validate.ts`

`validateSpec()` returns `ValidationDiagnostic[]`, but the type is not
re-exported from `analysis/index.ts`. Consumers must import directly from
`validate.ts` to type the return value.

### 5.5 `ParamDef`, `ImportPaths` Not in Analysis Barrel

**File:** `analysis/index.ts`

`ParamDef` and `ImportPaths` types are used internally and by adapters but
are not re-exported from `analysis/index.ts`. Only available via `ports.ts`
or direct import from `analysis/types.ts`.

---

## 6. Evaluator Engine Design

### 6.1 Per-Node Config Duplication

**File:** `evaluator/engine.ts:40-57`

Every `AGNode` instance stores `_dispatch`, `_rootKind`, and `_fileNameField`
as private fields. These values are identical across all nodes in a tree —
they're config, not per-node state. For a 10,000-node tree, this creates
30,000 redundant references.

A shared context object (e.g., `AGTreeConfig`) passed to the constructor
and stored once would reduce per-node overhead.

### 6.2 No Exhaustiveness Guard in Direction Switch

**File:** `evaluator/engine.ts:87-119`

```typescript
switch (entry.direction) {
  case 'syn': { ... }
  case 'inh': { ... }
  case 'collection': { ... }
  // no default — not exhaustive
}
```

If a new direction is added to `DispatchEntry`, this switch silently falls
through. An exhaustiveness guard (`default: { const _: never = entry; }`)
would catch this at compile time.

### 6.3 `parentIs` and `findFileName` Are Structural Query Utilities

**File:** `evaluator/engine.ts:137-150`

`parentIs()` and `findFileName()` are structural query methods on `AGNode` that
don't interact with attribute caching, cycle detection, or dispatch — the core
AG concerns. They're helper methods for equation authors. They could live in a
separate utility layer (or be provided via `Ctx`) rather than being baked into
the engine class.

### 6.4 M Type Parameter Completely Unconstrained

**File:** `evaluator/engine.ts:222`

```typescript
export function createEvaluator<K, M extends Record<string, unknown>, P>(
  config: EvaluatorConfig<K, P>
): Evaluator<M, P>
```

`M` (the attribute map for `TypedAGNode<M>`) is a free type parameter with no
relationship to the dispatch config, grammar, or spec. Callers can pass any `M`
and get back a `TypedAGNode<M>` that claims type safety but doesn't verify it:

```typescript
// This compiles but is wrong:
const evaluator = wireEvaluator<string, { foo: number }>({ grammar, spec, dispatch });
evaluator.buildTree(root).attr('foo'); // typed as number, actually undefined
```

---

## 7. Codegen Correctness

### 7.1 Equation Path Derivation Is Fragile

**File:** `analysis/compile.ts:308`

```typescript
const equationsPath = specImportPath.replace(/\/spec\.js$/, '/equations.js');
```

The generated import path for equation functions is derived by replacing
`/spec.js` with `/equations.js` in the spec path. This assumes:
1. The spec file is always named `spec.js`
2. Equations always live in a sibling file named `equations.js`

The equations directory restructuring (to `equations/index.ts` with barrel)
works because the barrel exports everything, but the assumption is implicit
and undocumented. If a spec uses a different filename, the generated import
breaks silently.

### 7.2 `compileAnalysis` Computes Dep Graph Twice

**File:** `analysis/compile.ts:460,471`

```typescript
const graph = buildDepGraphFromAttrs(allAttrs);  // line 460 — for topo sort
// ... generate dispatch ...
const depGraph = buildDepGraph(allAttrs);          // line 471 — for result
```

`buildDepGraph` internally calls `buildDepGraphFromAttrs` again. The dep
graph (edges + topological order) is computed twice during compilation.

### 7.3 No Test That Generated Dispatch Is Correct

The generated `dispatch.ts` files are tested indirectly (evaluator integration
tests exercise them), but no test verifies that:
- The generated code parses and type-checks
- The switch/case covers all kinds
- Equation function imports resolve correctly
- The `dispatchConfig` object has the right shape

A codegen round-trip test (regenerate → diff against committed) would catch
stale generated files.

---

## 8. Test Suite

### 8.1 Test Helper Duplication

The same fixture-loading pattern is reimplemented in 6+ files:

| File | Cache Variable | Function Name |
|------|---------------|---------------|
| `test/api/program.test.ts` | `_programCache` | `cachedProgram()` |
| `test/api/export.test.ts` | `_treeCache` | `buildTree()` |
| `test/integration/stamped-fields.test.ts` | `_treeCache` | `buildTree()` |
| `test/integration/kind-checking.test.ts` | `_buildCache` | `buildAndCheck()` |
| `test/e2e/e2e.test.ts` | `_programCache` | `cachedProgram()` |
| `test/e2e/violations.test.ts` | `_programCache` | `cachedProgram()` |

Each creates a `ts.Program` from fixture directories, caches it in a module-level
`Map`, and provides helper functions (`findCU`, `findDNodeByKind`). A shared
`test/helpers/fixtures.ts` would eliminate this duplication.

### 8.2 Fixture Loading Overlap

The same fixture directories are loaded independently by multiple test files:

| Fixture | Used In |
|---------|---------|
| `kind-basic` | program.test, config.test, kind-checking.test, e2e.test |
| `kind-violations` | program.test, kind-checking.test, e2e.test |
| `checker-properties` | violations.test |
| `checker-edges` | e2e.test |

Each file creates its own `ts.Program` and caches it separately. Cross-file
caching is not possible with the current vitest setup (each test file runs
in isolation), but the helper code could be shared.

### 8.3 Coverage Gaps

| Area | Status | Details |
|------|--------|---------|
| Generated dispatch execution | Indirect only | No test verifies generated switch/case code directly |
| Equation function error handling | Not tested | No test for what happens when an equation throws |
| `collectDepsForAttr()` | Not tested | Dep collection utility has no unit tests |
| Frontend error recovery | Not tested | No test for malformed TypeScript input |
| Config validation | Not tested | `loadConfig` accepts any shape, no test for bad configs |
| Watch mode | Not tested | Acknowledged in CLI; `fs.watch` callback untested |
| Large/deep ASTs | Not tested | No stress test for stack depth or performance |
| TSX/JSX conversion | Not tested | All fixtures are `.ts` only |

### 8.4 Weak Codegen Assertions

**File:** `test/codegen/codegen-scripts.test.ts`

```typescript
it('compileAnalysis produces dispatch and attr-types', () => {
  const result = compileAnalysis(grammar, analysisSpec);
  expect(result.dispatchFile.path).toBe('dispatch.ts');
  expect(result.attrTypesFile.path).toBe('attr-types.ts');
```

Tests verify file paths and non-empty content, but don't verify:
- Generated code is valid TypeScript
- Switch cases are exhaustive
- Import paths resolve correctly
- Function names match spec equations

---

## 9. Filesystem Organization

### 9.1 Current State (Post Round-1)

The round-1 restructuring achieved good organization:

```
grammar/         — 6 files (ports, base-types, schema-shapes, metadata, tree-ops, index)
analysis/        — 7 files (types, ctx, equation-utils, compile, validate, pivot, index)
evaluator/       — 3 files (types, engine, index)
specs/           — 2 adapters (ts-ast, mock)
app/             — 3 composition roots (cli, user-api, analysis-codegen)
test/            — 7 subdirectories mirroring architecture
```

### 9.2 Remaining Organizational Issues

**Issue 1:** `analysis/types.ts` still mixes port interfaces, codegen output
types (`CompiledAnalyzer`, `GeneratedFile`), and supporting types (`CodeLiteral`,
`AttrExpr`). The round-1 review extracted `equation-utils.ts` but left the
codegen output types in `types.ts`.

**Issue 2:** The `specs/ts-ast/kind-checking/equations/` directory barrel
(`index.ts`) re-exports everything from three sub-modules. This is correct,
but the generated import path derivation (`compile.ts:308`) assumes a specific
file structure. Making the barrel the canonical import point would be more robust.

**Issue 3:** `app/user-api/lib/export.ts` is a TS-AST-specific dashboard export
module living in the generic `user-api` composition root. It imports directly
from `specs/ts-ast/grammar/index.js` and uses hardcoded field traversal logic.
If a second grammar target were added, this module would need to be duplicated.

---

## 10. Recommendations

### P0 — Quick Wins (Low Risk, Immediate Value)

| # | Item | Files | Why |
|---|------|-------|-----|
| 1 | Route `app/` imports through barrels | `program.ts`, `pipeline.ts`, `ts-kind-checking.ts`, `mock.ts` | 5 barrel bypasses; all symbols already exported from barrels |
| 2 | Fix generated dispatch imports to use barrels | `analysis/compile.ts:301-302` | Change `/ctx.js` → `/index.js`, `/types.js` → `/index.js` |
| 3 | Remove dead `KindScriptConfig` fields | `app/user-api/lib/config.ts` | `include`, `exclude`, `strict` are never read |
| 4 | Add exhaustiveness guard to evaluator direction switch | `evaluator/engine.ts:87-119` | Prevents silent fallthrough if new direction added |
| 5 | Deduplicate `--depth` validation in CLI | `app/cli/cli.ts:61-76` | Extract depth validation to a helper |
| 6 | Remove unused grammar factory exports | `specs/ts-ast/grammar/index.ts`, `specs/mock/grammar/index.ts` | `createTSASTGrammar`, `createMockGrammar` never called externally |
| 7 | Export `ValidationDiagnostic`, `ParamDef`, `ImportPaths` from barrel | `analysis/index.ts` | Incomplete barrel; consumers must import from internals |

### P1 — Type Safety (Medium Effort)

| # | Item | Files | Why |
|---|------|-------|-----|
| 8 | Unify `ConvertContext` into shared definition | `specs/ts-ast/frontend/convert.ts`, `helpers.ts` | Two incompatible interfaces for the same concept |
| 9 | Use `IndexedNode` pattern in `export.ts` | `app/user-api/lib/export.ts:70,87` | Replace `as any` with proper intersection type |
| 10 | Make `FieldDef` a discriminated union by tag | `grammar/ports.ts:25-30` | Separate `typeRef` (child kind) from `propType` semantics |
| 11 | Add runtime validation to `loadConfig` | `app/cli/cli.ts:100-103` | Dynamic import returns `any`; validate shape before use |
| 12 | Replace `n: any` in `FieldExtractorFn` | `specs/ts-ast/frontend/convert.ts:99` | Use `Record<string, unknown>` instead of `any` |

### P2 — Architecture (Higher Effort)

| # | Item | Files | Why |
|---|------|-------|-----|
| 13 | Remove or downgrade `EvaluationPipeline` | `evaluator/types.ts`, `ports.ts`, barrels | Dead interface; only used as local type annotation |
| 14 | Unify spec validation into single entry point | `analysis/validate.ts`, `analysis/compile.ts` | Two validators with different scope; no unified check |
| 15 | Eliminate double dep graph computation in `compileAnalysis` | `analysis/compile.ts:460,471` | `buildDepGraphFromAttrs` called twice |
| 16 | Extract shared test helpers | `test/helpers/fixtures.ts` (new) | 6+ files duplicate fixture loading, caching, tree helpers |
| 17 | Factor `AGNode` shared config into context object | `evaluator/engine.ts` | `_dispatch`, `_rootKind`, `_fileNameField` duplicated per node |

### P3 — Test Coverage

| # | Item | Why |
|---|------|-----|
| 18 | Add codegen round-trip test | Verify regenerated dispatch matches committed version |
| 19 | Add `collectDepsForAttr` unit tests | Core equation utility has zero tests |
| 20 | Add config validation tests | `loadConfig` accepts any shape silently |
| 21 | Add equation error-path tests | No tests for what happens when equations throw |

### Not Recommended

- **Do not parameterize `DispatchConfig` by K** — dispatch is a runtime
  Record; K-linking belongs at `EvaluationTarget` and `EvaluatorConfig` level.
- **Do not add M-K linking to `createEvaluator`** — the M parameter is
  inherently unconstrained because the attribute map type is generated, not
  derived from K or P. Adding a constraint would require generated code to
  produce the constraint itself.
- **Do not refactor `SyntaxKind` cast** — the double-cast is the only way to
  dynamically index a TypeScript enum by string. No alternative exists without
  a complete redesign of the converter registration mechanism.
- **Do not restructure `analysis/types.ts` further** — round 1 already
  extracted equation utilities. The remaining contents (port interfaces,
  codegen output types, expression types) are small enough to coexist.
  Further splitting would create more files than it saves confusion.

---

## 11. Implementation Progress

All 21 recommendations have been implemented. Test suite: **28 files, 383 tests, all passing.**

### P0 — Quick Wins (All Complete)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Route `app/` imports through barrels | **Done** | `program.ts`, `pipeline.ts`, `ts-kind-checking.ts`, `mock.ts` all use barrel imports |
| 2 | Fix generated dispatch imports to use barrels | **Done** | `compile.ts` emits `/index.js` paths; dispatch regenerated |
| 3 | Remove dead `KindScriptConfig` fields | **Done** | `include`, `exclude`, `strict` removed from `config.ts` |
| 4 | Add exhaustiveness guard to evaluator direction switch | **Done** | `default: { const _: never = entry; }` in `engine.ts` |
| 5 | Deduplicate `--depth` validation in CLI | **Done** | `parseDepth()` helper in `cli.ts` |
| 6 | Remove unused grammar factory exports | **Done** | `createTSASTGrammar`, `createMockGrammar` made private (no longer exported) |
| 7 | Export `ValidationDiagnostic`, `ParamDef`, `ImportPaths` from barrel | **Done** | All re-exported from `analysis/index.ts` |

### P1 — Type Safety (All Complete)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 8 | Unify `ConvertContext` into shared definition | **Done** | Single definition in `helpers.ts`, imported by `convert.ts` |
| 9 | Use `IndexedNode` pattern in `export.ts` | **Done** | `type IndexedNode = KSNode & { [key: string]: unknown }` replaces `as any` |
| 10 | Make `FieldDef` a discriminated union by tag | **Done** | `ChildFieldDef | PropFieldDef` in `grammar/ports.ts`; prop uses `propType`, child uses `typeRef` |
| 11 | Add runtime validation to `loadConfig` | **Done** | Validates object shape and `analysisDepth` value |
| 12 | Replace `n: any` in `FieldExtractorFn` | **Done** | Uses `Record<string, unknown>` instead |

### P2 — Architecture (All Complete)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 13 | Remove `EvaluationPipeline` | **Done** | Removed from `evaluator/types.ts`, `evaluator/index.ts`, `ports.ts`; `program.ts` calls adapters directly |
| 14 | Unify spec validation | **Done** | `validateSpecConsistency` exported from `analysis/index.ts`; called in codegen pipeline |
| 15 | Eliminate double dep graph computation | **Done** | `compileAnalysis` reuses `buildDepGraphFromAttrs` result |
| 16 | Extract shared test helpers | **Done** | `test/helpers/fixtures.ts` with shared caching, tree helpers |
| 17 | Factor `AGNode` shared config into context object | **Done** | `AGTreeConfig` interface; `_dispatch`, `_rootKind`, `_fileNameField` stored once per tree |

### P3 — Test Coverage (All Complete)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 18 | Codegen round-trip test | **Done** | `test/codegen/codegen-roundtrip.test.ts` |
| 19 | `collectDepsForAttr` unit tests | **Done** | `test/ports/collect-deps.test.ts` |
| 20 | Config validation tests | **Done** | `test/api/config-validation.test.ts` |
| 21 | Equation error-path tests | **Done** | `test/ports/equation-errors.test.ts` |
