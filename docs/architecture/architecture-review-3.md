# KSC Architecture Review — Round 3

Date: 2026-03-09

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Type Safety Audit](#2-type-safety-audit)
3. [Architectural Contracts](#3-architectural-contracts)
4. [Code Generation Fragility](#4-code-generation-fragility)
5. [Evaluator Engine](#5-evaluator-engine)
6. [Mutable State and Side Effects](#6-mutable-state-and-side-effects)
7. [Filesystem and Organization](#7-filesystem-and-organization)
8. [Test Suite](#8-test-suite)
9. [Error Handling](#9-error-handling)
10. [Recommendations](#10-recommendations)

---

## 1. Executive Summary

Rounds 1 and 2 brought the codebase to a high quality bar: barrel imports are
consistent, port boundaries are clean, dead code is removed, `FieldDef` is a
proper discriminated union, and shared test helpers are in place. All 383 tests
pass across 28 files.

This round focuses on **deeper structural issues** that survived the earlier
cleanups — patterns that work correctly today but create fragility, implicit
contracts, or missed type safety opportunities.

**Key findings:**

- **`SUM_TYPES as Record<string, any>`** is the only remaining `as any` in port
  machinery. It can be replaced with a safe cast to `Record<string, SumTypeDefShape>`.
- **Equation import paths are regex-derived** — `compile.ts` uses string
  replacement to infer equation and type import locations. This is the
  single most fragile code generation assumption.
- **Module-level mutable counter** in `definitions.ts` creates an implicit
  lifecycle contract: callers must invoke `resetCounter()` before evaluation.
  The reset is wired through `spec.setup` but the dependency is invisible.
- **Comment attachment bypasses readonly** — `convert.ts` uses `as any` to
  mutate nodes post-construction, violating the immutability contract on
  `KSNodeBase`.
- **`ports.ts` is never imported** — it re-exports all port contracts for
  discoverability but no code uses it. It's documentation masquerading as code.
- **Parameterized attribute cache is unbounded** — high-cardinality parameters
  (e.g., arbitrary strings) would cause linear memory growth per node.
- **No custom error types** — all errors are plain `Error` with message strings.
  Programmatic error handling requires regex matching on messages.

**Architecture health:** 9.5/10. Issues are minor and localized. The ports-and-
adapters layering is exemplary.

---

## 2. Type Safety Audit

### 2.1 `as any` Census (Production Code)

12 `as any` casts remain outside `generated/` and `dashboard/`:

| File | Line | Cast | Avoidable? |
|------|------|------|-----------|
| `analysis/types.ts` | 40 | `(value as any).__codeLiteral` | Yes — use `'__codeLiteral' in value` |
| `specs/ts-ast/grammar/index.ts` | 38 | `SUM_TYPES as Record<string, any>` | Yes — cast to `Record<string, SumTypeDefShape>` |
| `specs/mock/grammar/index.ts` | 25 | `SUM_TYPES as Record<string, any>` | Yes — same fix |
| `specs/ts-ast/frontend/convert.ts` | 55 | `(ksNode as any).leadingComments` | Partially — could extend `KSNodeBase` |
| `specs/ts-ast/frontend/convert.ts` | 58 | `(ksNode as any).trailingComments` | Partially — same |
| `specs/ts-ast/frontend/convert.ts` | 129 | `node as any` | Yes — use `ts.ImportDeclaration` |
| `specs/ts-ast/frontend/helpers.ts` | 45 | `(node as any).locals?.size` | No — TS compiler internal |
| `specs/ts-ast/frontend/helpers.ts` | 144 | `(node as any).modifiers` | No — TS compiler internal |
| `specs/ts-ast/frontend/helpers.ts` | 199 | `(ts.NodeFlags as any).AwaitUsing` | No — pre-5.2 compat |
| `specs/ts-ast/frontend/helpers.ts` | 200 | `(ts.NodeFlags as any).Using` | No — pre-5.2 compat |

**5 are avoidable**, 5 are forced by the TypeScript compiler's internal API.
The two `SUM_TYPES as Record<string, any>` casts are the most impactful because
they're in port-adjacent adapter code that should be maximally type-safe.

### 2.2 `isCodeLiteral` Type Guard

**File:** `analysis/types.ts:39-41`

```typescript
export function isCodeLiteral(value: unknown): value is CodeLiteral {
  return value !== null && typeof value === 'object' && (value as any).__codeLiteral === true;
}
```

The `as any` bypasses type narrowing. TypeScript supports `in` checks for
property existence:

```typescript
return value !== null && typeof value === 'object'
  && '__codeLiteral' in value && value.__codeLiteral === true;
```

This eliminates the cast and is semantically identical.

### 2.3 Comment Attachment Violates Readonly

**File:** `specs/ts-ast/frontend/convert.ts:55,58`

```typescript
(ksNode as any).leadingComments = leading.map(toCommentRange);
(ksNode as any).trailingComments = trailing.map(toCommentRange);
```

`KSNodeBase` has `readonly [key: string]: unknown`. These assignments use
`as any` to bypass that guarantee. The comments are set immediately after
node construction — they could instead be included in the node's initial
field set if the converter's `createNode()` call included them.

Alternatively, `KSNodeBase` could declare optional `leadingComments` and
`trailingComments` fields, making the assignment type-safe via the existing
index signature.

### 2.4 `SUM_TYPES` Cast Can Be Narrowed

**Files:** `specs/ts-ast/grammar/index.ts:38`, `specs/mock/grammar/index.ts:25`

```typescript
createGrammarMetadata(NODES_RAW, SUM_TYPES as Record<string, any>)
```

The `createGrammarMetadata` parameter type is `Record<string, SumTypeDefShape>`.
The `as const satisfies` pattern on `SUM_TYPES` produces a compatible type that
TypeScript can't auto-widen. But the cast only needs to go to
`Record<string, SumTypeDefShape>`, not `any`:

```typescript
createGrammarMetadata(NODES_RAW, SUM_TYPES as Record<string, SumTypeDefShape>)
```

This preserves type checking inside `createGrammarMetadata` while solving the
readonly/widening issue.

### 2.5 Dispatch Entry Types Use `any`

**File:** `evaluator/types.ts:21-41`

All three dispatch entry types use `any` for parameters and return values:

```typescript
compute: (ctx: Ctx, ...args: any[]) => any;     // SynDispatchEntry
computeRoot: (ctx: Ctx, ...args: any[]) => any;  // InhDispatchEntry
init: any;                                        // CollectionDispatchEntry
combine: (acc: any, contrib: any) => any;
```

This is **intentional** — dispatch is a runtime-wired layer where type safety
comes from the `TypedAGNode<M>` wrapper at the consumer boundary, not from the
dispatch config itself. The `any` types cannot be eliminated without making
dispatch generic over the full attribute map, which would require generated code
to produce type parameters — a significant increase in codegen complexity for
no runtime benefit.

**Status:** Acceptable architectural decision. Documented here for completeness.

### 2.6 `M` Type Parameter Is Unconstrained

**File:** `evaluator/engine.ts:227`

```typescript
export function createEvaluator<K, M extends Record<string, unknown>, P>(
  config: EvaluatorConfig<K, P>
): Evaluator<M, P>
```

`M` (the attribute map for `TypedAGNode<M>`) has no relationship to the dispatch
config, grammar, or spec. Callers can pass any `M` and get back a `TypedAGNode<M>`
that claims type safety without verifying it.

This is a known limitation. `M` is generated (as `KSCAttrMap` in `attr-types.ts`)
and cannot be derived from `K` or `P` without a type-level computation that
TypeScript doesn't support. The generated `attr-types.ts` is the single source
of truth for attribute types.

**Status:** Acceptable. No fix possible without TypeScript supporting dependent
type parameters.

---

## 3. Architectural Contracts

### 3.1 `ports.ts` Is Never Imported

**File:** `ports.ts` (107 lines)

`ports.ts` re-exports all port contracts from `grammar/index.ts`,
`analysis/index.ts`, and `evaluator/index.ts`. It serves as a "single
discoverable entry point" per CLAUDE.md.

However, **no file in the codebase imports from `ports.ts`**. All consumers
import directly from the barrel modules. This makes `ports.ts` purely
documentation — it's TypeScript code that compiles but has no consumers.

**Options:**
1. **Keep as documentation** — it compiles, so it validates that all contracts
   are export-compatible. If a barrel breaks, `ports.ts` catches it at typecheck.
2. **Convert to a `.md` file** — remove code pretending to be imports. Document
   the contracts in prose instead.
3. **Make it the canonical import** — redirect all port imports through `ports.ts`.
   This would create a single import source but add an extra barrel layer.

**Recommendation:** Keep option 1 (current). It serves as a compile-time contract
check even though it has no runtime consumers. Add a comment at the top:

```typescript
/**
 * PORT CONTRACT REGISTRY — compile-time validation only.
 *
 * This file is never imported at runtime. It exists to ensure all port
 * interfaces are correctly exported from their barrel modules. If a barrel
 * export is removed or renamed, this file will fail to compile.
 */
```

### 3.2 Implicit Lifecycle Contract: `spec.setup`

**File:** `specs/ts-ast/kind-checking/equations/definitions.ts:20`

```typescript
let _counter: DefIdCounter = { value: 0 };

export function resetCounter(): void {
  _counter = { value: 0 };
}
```

The `_counter` is the only module-level mutable state in the production codebase.
Its lifecycle depends on `analysisSpec.setup` calling `resetCounter()` before
each evaluation — but this contract is invisible:

1. `resetCounter()` is exported from `definitions.ts`
2. Re-exported through `equations/index.ts`
3. Called by `spec.ts:160`: `setup: () => { resetCounter(); }`
4. Wired by `wireEvaluator()` via `config.setup`
5. Called by `createEvaluator().evaluate()` at `engine.ts:238`

If step 3 is accidentally removed, definition IDs will be monotonically
increasing across evaluations — a subtle data bug with no error. The five-hop
dependency chain makes this easy to break during refactoring.

### 3.3 No Validation of Equation Directory Structure

The codegen pipeline assumes that equations live at a fixed path relative
to the spec file. Three regex-based replacements enforce this:

| Location | Pattern | Assumption |
|----------|---------|-----------|
| `analysis/compile.ts:308` | `/spec\.js$/ → /equations/index.js` | Equations in sibling `equations/` dir |
| `specs/ts-ast/kind-checking/spec.ts:154` | `/spec\.js$/ → /types.js` | Types in sibling `types.js` file |

No codegen validation checks that these sibling files actually exist.
If the equations directory is renamed or the spec file is moved, the
generated dispatch will have broken imports that only surface at
TypeScript compilation time — not at codegen time.

---

## 4. Code Generation Fragility

### 4.1 String-Based Template Generation

**File:** `analysis/compile.ts` (487 lines)

The entire dispatch code generator constructs TypeScript source via string
concatenation (`L.push(...)` into an array of lines). This approach:

- **Works reliably** for the current 8-attribute spec
- **Is fragile** because there's no AST validation — malformed output
  is only caught by downstream TypeScript compilation
- **Has no escaping** — attribute names, kind names, and function names
  are interpolated directly into templates. Special characters would
  produce invalid TypeScript.

**Current mitigations:**
- `validateSpecConsistency()` checks function names exist (line 412)
- Generated code is committed and diff-reviewed
- Codegen roundtrip test catches stale output

**Risk assessment:** Low for current use. Higher if the system grows to
support user-defined analyses where attribute/kind names aren't controlled.

### 4.2 `GeneratedImports` Has Implicit Defaults

**File:** `analysis/types.ts:146-155`

```typescript
export interface GeneratedImports {
  specImportPath?: string;
  grammarImportPath?: string;
  analysisImportPath?: string;
  evaluatorImportPath?: string;
  equationsImportPath?: string;  // NOT PRESENT — inferred from specImportPath
}
```

The equations import path is derived from `specImportPath` via regex (§3.3),
but there's no explicit `equationsImportPath` field in `GeneratedImports`.
Adding this field would make the directory structure assumption explicit
and overridable.

### 4.3 `typeImports` Callback Uses Same Regex Pattern

**File:** `specs/ts-ast/kind-checking/spec.ts:153-156`

```typescript
typeImports: ({ specImportPath }) => {
  const specTypesPath = specImportPath.replace(/\/spec\.js$/, '/types.js');
  return [
    `import type { KindDefinition, Diagnostic } from '${specTypesPath}';`,
  ];
},
```

This callback receives `specImportPath` from the codegen pipeline and derives
a sibling `types.js` path using the same regex pattern as compile.ts. If a
spec doesn't follow the `spec.js` naming convention, both the equation imports
and the type imports break silently.

---

## 5. Evaluator Engine

### 5.1 Parameterized Cache Growth

**File:** `evaluator/engine.ts:72-74`

```typescript
const pCache = this._paramCache.get(name);
if (pCache?.has(param)) return pCache.get(param);
```

The parameterized cache uses a `Map<string, Map<unknown, unknown>>` — one inner
map per parameterized attribute, keyed by parameter value. For the current
kind-checking spec, parameters are property name strings from a fixed set
(8 properties), so the cache stays bounded.

But the architecture doesn't enforce this. If a future analysis uses
high-cardinality parameters (e.g., line numbers, arbitrary identifiers),
the cache would grow linearly per node. For a 10,000-node tree with
100 unique parameters, that's 1M cache entries.

**Mitigations:**
- Document the performance contract: parameterized attributes should have
  bounded parameter cardinality
- Optionally add a cache size warning in debug mode

### 5.2 Cycle Detection Is Per-Node Only

**File:** `evaluator/engine.ts:79-85`

The `_cyc` set tracks currently-evaluating attributes on a single node.
This catches self-loops (`attr('x') → attr('x')` on the same node) but
**does not detect cross-node cycles**:

```
nodeA.attr('x') → nodeB.attr('y') → nodeA.attr('x')  // NOT detected
```

Cross-node cycles would cause a stack overflow. In practice, the AG evaluation
model (inherited flows down, synthesized flows up, collections fold children)
makes cross-node cycles structurally impossible for well-formed specs. But
there's no compile-time or codegen-time guarantee of this property.

### 5.3 `parentIs` and `findFileName` as Engine Methods

**File:** `evaluator/engine.ts:143-160`

`parentIs()` and `findFileName()` are structural query methods on `AGNode` that
don't interact with attribute caching, cycle detection, or dispatch. They're
convenience methods for equation authors.

This is a minor separation-of-concerns issue — the engine class mixes core AG
concerns (dispatch, caching, cycles) with utility queries. In a larger system,
these could live on `Ctx` or in a separate utility layer. For the current
codebase, this is acceptable.

---

## 6. Mutable State and Side Effects

### 6.1 Counter State in Definitions

As detailed in §3.2, `definitions.ts:20` holds the only module-level mutable
state. The implicit lifecycle contract (reset before evaluate) is correctly
wired but fragile.

**A safer pattern** would encapsulate the counter inside the spec's `setup`
function via a closure, eliminating the module-level mutable binding:

```typescript
// In spec.ts — counter created per-evaluation, not per-module
const analysisSpec: AnalysisSpec<TSNodeKind, KSCProjections> = {
  attrs: allAttrs,
  projections,
  setup: () => {
    // Counter is created fresh each time — no module state needed
    initCounter();
  },
};
```

However, this would require threading the counter through equation functions
differently. The current approach works and is well-tested.

### 6.2 No Other Mutable State

The rest of the production codebase is stateless:
- Grammar metadata: computed once, frozen
- Analysis compilation: pure function
- Evaluator: per-tree state only (AGNode instances own their caches)
- Frontend converter: `ConvertContext` is per-conversion, not global

---

## 7. Filesystem and Organization

### 7.1 Current Structure (Post Round 2)

```
ports.ts                          Contract registry (never imported, compile-time only)
grammar/          6 files         Port: Grammar<K>, ASTNode, FieldDef, Frontend
analysis/         7 files         Port: AnalysisSpec, Ctx, compilation, validation
evaluator/        3 files         Port: DispatchConfig, AGNode, evaluator factory
specs/
  ts-ast/
    grammar/      2 files         Adapter: Grammar<TSNodeKind>
    frontend/     2 files         Adapter: Frontend<ts.Program, KSProgram>
    kind-checking/
      equations/  4 files         Equation functions + barrel
      spec.ts, types.ts           AnalysisSpec<TSNodeKind, KSCProjections>
  mock/
    grammar/      2 files         Adapter: Grammar<MockKind>
    mock-analysis/ 1 file         Adapter: AnalysisSpec<MockKind, MockProjections>
app/
  cli/            1 file          Composition root: CLI
  user-api/       5 files         Composition root: evaluation pipeline
  analysis-codegen/ 3 files       Composition root: codegen
generated/
  ts-ast/kind-checking/ 2 files   Generated dispatch + attr-types
test/
  adapters/       7 files         Grammar + frontend + analysis adapter tests
  api/            5 files         CLI + user-api tests
  codegen/        3 files         Codegen pipeline tests
  e2e/            3 files         End-to-end tests
  integration/    3 files         Grammar-analysis integration tests
  ports/          7 files         Port machinery tests
  type-safety/    1 file          Type-level verification
  helpers/        1 file          Shared fixtures
  fixtures/       5 dirs          Test data
```

### 7.2 Organization Quality

The directory structure closely mirrors the architecture. Each module has
a clear responsibility and the test hierarchy maps to source concerns.

**Remaining observations:**

1. **`app/user-api/lib/export.ts`** is a TS-AST-specific dashboard export
   module living in the generic `user-api` composition root. It imports
   directly from `specs/ts-ast/grammar/index.js` and uses hardcoded field
   traversal logic. If a second grammar target were added, this module
   would need to be duplicated or parameterized.

2. **`test/type-safety/`** contains a single file that uses `// @ts-expect-error`
   to verify type-level contracts. This is a compile-time-only test pattern
   and could be placed alongside the ports it tests rather than in its own
   directory.

3. **Git status shows phantom untracked files** — 9 test files appear as
   untracked (`??`) in `git status` but don't exist on disk. These are
   artifacts from the round 1/2 reorganization where files were moved to
   subdirectories. The old paths appear untracked because git sees them as
   new files that haven't been staged. Staging the test directory would
   clean this up.

### 7.3 No Cross-Root Imports

The three `app/` subdirectories maintain strict isolation:
- `app/cli/` → imports `app/user-api/` (allowed: CLI consumes the public API)
- `app/user-api/` → imports ports + specs + generated (no other app/)
- `app/analysis-codegen/` → imports ports + specs (no other app/)

No violations detected.

---

## 8. Test Suite

### 8.1 Coverage Summary

**29 test files, 383 tests, all passing.**

| Source Module | Test Files | Coverage |
|---------------|-----------|----------|
| grammar/ | schema-utils, builders | Port machinery fully tested |
| analysis/ | compile-analysis, validate, pivot, collect-deps, equation-errors | Port machinery fully tested |
| evaluator/ | evaluator | Port machinery fully tested |
| specs/ts-ast/grammar/ | grammar-coverage, node-schema | Adapter tested |
| specs/ts-ast/frontend/ | convert, convert-helpers | Adapter tested |
| specs/ts-ast/kind-checking/ | kind-checking, violations | Adapter tested |
| specs/mock/ | mock-evaluator, codegen-mock | Adapter tested |
| app/cli/ | cli, config-validation | Composition root tested |
| app/user-api/ | program, config, export | Composition root tested |
| app/analysis-codegen/ | codegen-scripts, codegen-roundtrip | Composition root tested |

### 8.2 Remaining Helper Duplication

The shared `test/helpers/fixtures.ts` is imported by 6 test files that need
fixture caching. However, some duplication remains:

1. **`test/e2e/serialize.test.ts`** has a local `cachedProgram()` function
   (lines 18-26) that reimplements the caching pattern from
   `fixtures.ts:buildProgram()`. This should use the shared helper.

2. **Compiler setup** is repeated in `test/adapters/convert-helpers.test.ts`
   and `test/adapters/convert.test.ts` — both create a `ts.Program` with
   nearly identical configuration. This could be extracted to fixtures.

### 8.3 Test Assertion Quality

Test assertions are specific and meaningful throughout:
- Structural checks use `toEqual()` with expected objects
- Counts use `toBeGreaterThan()` with minimum thresholds
- Reference equality is tested where caching matters (`toBe()`)
- Error paths are tested with `toThrow()` and message pattern matching

### 8.4 Coverage Gaps

| Area | Status | Impact |
|------|--------|--------|
| Watch mode (`cli.ts`) | Not tested | Low — filesystem events are hard to test |
| TSX/JSX conversion | Not tested | Medium — all fixtures are `.ts` only |
| Large/deep ASTs | Not tested | Low — no stress test for stack depth |
| `spec.setup` lifecycle | Implicitly tested | Medium — no test verifies counter reset between evaluations |
| `ports.ts` compile check | Not tested | Low — typecheck covers it |

---

## 9. Error Handling

### 9.1 Error Types

The entire codebase uses plain `Error` with template string messages.
No custom error classes or error codes exist.

**Error categories:**

| Category | Location | Example Message |
|----------|----------|-----------------|
| Unknown attribute | `engine.ts:66` | `Unknown attribute 'foo' on Identifier` |
| Cycle detection | `engine.ts:83` | `Circular attribute access: 'kindDefs' on Root` |
| Dispatch mismatch | `engine.ts:207` | `Missing dispatch entries for attributes: foo` |
| Spec validation | `compile.ts:400` | `Analysis spec validation failed:\n  - ...` |
| Dep graph cycle | `compile.ts:143` | `Cycle in dep graph: kindDefs` |
| Config validation | `cli.ts:99,105` | `Config file must export an object: ...` |
| Exhaustiveness | various | `Unhandled kind: ...` (unreachable) |

### 9.2 Programmatic Error Handling

Without error codes or custom types, consumers must match on error messages
to distinguish error categories. This is adequate for a CLI tool and library
where errors are typically displayed, not programmatically recovered from.

If the project grows to support IDE integrations or language server protocol
(LSP), structured errors with codes would be valuable. For now, the current
approach is appropriate.

---

## 10. Recommendations

### P0 — Quick Wins (Low Risk, Immediate Value)

| # | Item | Files | Why |
|---|------|-------|-----|
| 1 | Narrow `SUM_TYPES` cast from `any` to `SumTypeDefShape` | `specs/ts-ast/grammar/index.ts:38`, `specs/mock/grammar/index.ts:25` | Eliminates 2 `as any` with zero behavior change |
| 2 | Replace `as any` in `isCodeLiteral` with `in` check | `analysis/types.ts:39-41` | Eliminates 1 `as any`; `'__codeLiteral' in value` is idiomatic |
| 3 | Add `equationsImportPath` to `GeneratedImports` | `analysis/types.ts:146-155` | Makes equation directory assumption explicit and overridable |
| 4 | Add contract comment to `ports.ts` | `ports.ts:1` | Document that this file is a compile-time contract check, not runtime code |
| 5 | Clean up git phantom files | `test/` directory | Stage the test reorganization so `git status` is accurate |

### P1 — Type Safety (Medium Effort)

| # | Item | Files | Why |
|---|------|-------|-----|
| 6 | Add `leadingComments`/`trailingComments` to `KSNodeBase` | `grammar/base-types.ts`, `specs/ts-ast/frontend/convert.ts:55,58` | Eliminates 2 `as any` by making comment fields part of the type |
| 7 | Narrow `node as any` to `ts.ImportDeclaration` in converter | `specs/ts-ast/frontend/convert.ts:129` | Eliminates 1 `as any` in context-specific handler |
| 8 | Validate equation sibling files at codegen time | `analysis/compile.ts:308` | Check that derived equation/type paths exist before generating imports |

### P2 — Architecture (Higher Effort)

| # | Item | Files | Why |
|---|------|-------|-----|
| 9 | Encapsulate definition counter lifecycle | `specs/ts-ast/kind-checking/equations/definitions.ts:20` | Module-level mutable state with implicit reset contract; make lifecycle explicit |
| 10 | Document parameterized cache performance contract | `evaluator/engine.ts:72-74` | Unbounded cache for high-cardinality params; add JSDoc noting bounded-param assumption |
| 11 | Consolidate remaining test helper duplication | `test/e2e/serialize.test.ts:18-26`, `test/adapters/convert*.test.ts` | Local caching reimplements `fixtures.ts` pattern |

### P3 — Future-Proofing

| # | Item | Why |
|---|------|-----|
| 12 | Add TSX/JSX fixture and test | Frontend converter untested with JSX syntax |
| 13 | Add `setup` lifecycle test | Verify counter reset between successive evaluations |
| 14 | Consider structured error types if LSP/IDE integration planned | Plain `Error` insufficient for programmatic error handling |

### Not Recommended

- **Do not parameterize `DispatchConfig` by attribute types** — dispatch is a
  runtime record; type safety belongs at the `TypedAGNode<M>` consumer boundary.
  Adding generics to dispatch would cascade into generated code for no benefit.
- **Do not add cross-node cycle detection** — the AG evaluation model
  (inh down, syn up, collection fold) makes cross-node cycles structurally
  impossible for well-formed specs. Adding detection would add per-call overhead
  to every attribute evaluation.
- **Do not move `ports.ts` to documentation** — it serves as a compile-time
  validation that all port contracts remain export-compatible. Removing it
  loses that guarantee.
- **Do not add cache eviction to parameterized attrs** — immutable trees don't
  need invalidation. Cache eviction would add complexity for a problem that
  only exists with high-cardinality parameters, which the system doesn't
  currently use.
- **Do not AST-validate generated code** — the string-based template approach
  works reliably for 8 attributes. AST-based generation (e.g., via ts-morph)
  would add a heavy dependency for marginal safety improvement.

---

## 11. Implementation Progress

P0 and P1 items implemented. Typecheck clean, 28 test files, 383 tests passing.

### P0 — Quick Wins (All Complete)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Narrow `SUM_TYPES` cast to `SumTypeDefShape` | **Done** | Both `specs/ts-ast/grammar/index.ts:38` and `specs/mock/grammar/index.ts:25` |
| 2 | Replace `as any` in `isCodeLiteral` with `in` check | **Done** | `analysis/types.ts:40` uses `'__codeLiteral' in value` |
| 3 | Add `equationsImportPath` to `GeneratedImports` | **Done** | New field in `analysis/types.ts`; compile.ts uses it with regex fallback |
| 4 | Add contract comment to `ports.ts` | **Done** | Header explains compile-time-only purpose |
| 5 | Clean up git phantom files | **N/A** | Files don't exist on disk; these are unstaged deletions from prior reorg, not phantom untracked files. Cleanup requires committing the reorganization. |

### P1 — Type Safety (All Complete)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 6 | Add `leadingComments`/`trailingComments` to `KSNodeBase` | **Already done** | Fields already existed in `grammar/base-types.ts:21-22`; removed `as any` from `convert.ts:55,58` — direct assignment works |
| 7 | Narrow `node as any` to `ts.ImportDeclaration` | **Done** | `convert.ts:129` now casts via `as unknown as ts.ImportDeclaration` |
| 8 | Validate equation sibling files at codegen time | **Done** | `pipeline.ts` resolves equation path against outputDir and warns if missing |
