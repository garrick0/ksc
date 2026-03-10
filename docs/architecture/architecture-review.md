# KSC Architecture Review

Date: 2026-03-09
Last updated: 2026-03-09

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Assessment](#2-architecture-assessment)
3. [Type Safety Issues](#3-type-safety-issues)
4. [Separation of Concerns](#4-separation-of-concerns)
5. [Redundancy and Dead Code](#5-redundancy-and-dead-code)
6. [Filesystem Structure Analysis](#6-filesystem-structure-analysis)
7. [Test Suite Analysis](#7-test-suite-analysis)
8. [Recommendations](#8-recommendations)
9. [Implementation Progress](#9-implementation-progress)

---

## 1. Executive Summary

The KSC codebase implements a clean ports-and-adapters architecture with strong
separation of concerns. The port boundaries are properly enforced — no spec-specific
imports leak into generic machinery, composition roots are fully isolated, and there
are zero circular dependencies.

**Key strengths:**
- Clean port/adapter/composition root layering
- K-type parameter linking prevents grammar/spec mismatches
- No grammar codegen (pure type-level derivation)
- Stateless converters with explicit context passing
- Runtime validation catches stale codegen at startup

**Areas for improvement:**
- Incomplete K-linking in `EvaluatorConfig` and `DispatchConfig`
- 26 `as any` casts in production code (most justified, some removable)
- `equations.ts` at 448 lines mixes three concerns
- Test suite has overlap between integration/e2e tests
- `schema-utils.ts` mixes metadata computation and serialization
- Spec adapters import directly from port internals instead of barrels
- `examples/showcase.ts` imports directly from adapter internals

---

## 2. Architecture Assessment

### 2.1 Port Boundary Cleanliness

All port modules (`grammar/`, `analysis/`, `evaluator/`) have zero imports from
`specs/` or `app/`. Verified by import analysis:

```
grammar/derive.ts      → no external imports
grammar/schema-utils.ts → imports only from grammar/derive.ts
analysis/types.ts      → imports Ctx (analysis/ctx), Grammar (grammar/derive)
analysis/ctx.ts        → imports ASTNode (grammar/derive)
analysis/compile.ts    → imports from grammar/derive, analysis/types, analysis/ctx
evaluator/types.ts     → imports from grammar/derive, analysis/types, analysis/ctx
evaluator/engine.ts    → imports from grammar/derive, analysis/types, evaluator/types
```

No violations. The layering is: `grammar → analysis → evaluator`.

### 2.2 Composition Root Isolation

The three `app/` directories are fully isolated:

| Root | Imports From | Cross-Root Imports |
|------|-------------|-------------------|
| `app/cli/` | `app/user-api/` only | None (cli depends on user-api, acceptable) |
| `app/user-api/` | ports + specs + generated | None |
| `app/analysis-codegen/` | ports + specs | None |

### 2.3 K-Type Parameter Linking

The `K` type parameter flows correctly through composition boundaries:

```
Grammar<TSNodeKind> ←→ AnalysisSpec<TSNodeKind, KSCProjections>
        ↓                        ↓
CodegenTarget<TSNodeKind, KSCProjections>    (codegen root)
EvaluationTarget<TSNodeKind, KSCProjections> (evaluation root)
```

TypeScript prevents mismatched grammar/spec pairs at the composition root level.

**Gap:** `EvaluatorConfig<P>` and `DispatchConfig` are NOT parameterized by K.
See [Section 3.1](#31-incomplete-k-linking).

### 2.4 Generated Code Quality

Generated dispatch files (`generated/ts-ast/kind-checking/dispatch.ts`) demonstrate:
- Exhaustive switch/case with `never` default (compiler-enforced completeness)
- Proper per-kind equation casts: `ctx as unknown as KindCtx<KindToNode['CompilationUnit']>`
- Auto-generated imports from equation modules via function name reflection

Generated attr-types files provide `KSCAttrMap` for `TypedAGNode<M>` narrowing.
Parameterized attributes are correctly excluded (they can't be statically typed).

---

## 3. Type Safety Issues

### 3.1 Incomplete K-Linking

**Severity: High** | **Files:** `evaluator/types.ts`

`EvaluatorConfig<P>` has `grammar: Grammar` (no K parameter). This means you could
wire a `Grammar<MockKind>` with a dispatch generated for `TSNodeKind` and TypeScript
wouldn't catch it.

```typescript
// Current — no K-linking
export interface EvaluatorConfig<P> {
  dispatch: DispatchConfig;       // Record<string, DispatchEntry> — no K
  grammar: Grammar;               // Grammar<string> — no K
  projections: { ... };
}

// Better — K-linked
export interface EvaluatorConfig<K extends string = string, P extends Record<string, unknown> = Record<string, unknown>> {
  dispatch: DispatchConfig;
  grammar: Grammar<K>;
  projections: { [Key in keyof P]: (root: Ctx) => P[Key] };
}
```

`EvaluationTarget<K, P>` already has K-linking and is used by `wireEvaluator()`.
The gap is only in `EvaluatorConfig`, which is used by `createEvaluator()`. Since
`wireEvaluator` delegates to `createEvaluator`, the K constraint is lost at that call
boundary.

### 3.2 `Ctx.attr()` Returns `any`

**Severity: Medium** | **File:** `analysis/ctx.ts:17`

```typescript
attr(name: string, ...args: unknown[]): any;
```

All equation functions receive `Ctx` and call `ctx.attr('someAttr')`, getting
back `any`. This means equation logic is untyped — typos in attribute names
or wrong return type assumptions are not caught.

**Mitigation:** `TypedAGNode<M>` exists for consumer-facing code, but equations
themselves always use the base `Ctx` interface. This is a fundamental design
constraint — equation functions are defined in specs before the evaluator
wires them, so they can't know the full attribute map at definition time.

**Possible improvement:** A spec-local `TypedCtx` that narrowing attr() for
attributes defined within that spec, rather than a fully generic `Ctx`.

### 3.3 `as any` Audit (26 Uses in Production Code)

Categorized by justification:

**Removable (could use narrower types):**

| File | Line(s) | Cast | Fix |
|------|---------|------|-----|
| `grammar/schema-utils.ts` | 84, 256 | `(node as any)[f.name]` | `(node as Record<string, unknown>)[f.name]` |
| `grammar/schema-utils.ts` | 109 | `const node: any = { kind, ... }` | Type as `ASTNode & Record<string, unknown>` |
| `grammar/schema-utils.ts` | 410-413 | `nodes as any` (4x in createGrammarMetadata) | Use `as Record<string, NodeDefShape>` |
| `evaluator/engine.ts` | 147 | `(current.node as any)[this._fileNameField]` | `(current.node as Record<string, unknown>)[...]` |
| `evaluator/engine.ts` | 172 | `(raw as any)[f.name]` | `(raw as Record<string, unknown>)[f.name]` |
| `equations.ts` | 238 | `(k.properties as any)[property]` | Index with proper Record type |

**Justified (TS library interop or intentional contracts):**

| File | Line(s) | Cast | Why |
|------|---------|------|-----|
| `analysis/ctx.ts` | 17 | `attr(): any` return | Dynamic dispatch contract |
| `analysis/types.ts` | 55-56 | `withDeps` mutation | Function metadata pattern |
| `analysis/types.ts` | 68-77 | `(v as any).deps` | Reading metadata |
| `evaluator/types.ts` | 28,34,36,42,44,86 | Dispatch signatures | Variadic generic dispatch |
| `frontend/convert.ts` | 99,185,245-246 | TS AST field access | `ts.Node` is loosely typed upstream |
| `frontend/helpers.ts` | 45,144,156,199-200 | TS internals | `.locals`, `.modifiers`, `NodeFlags` |
| `equations.ts` | 295 | `.expression.kind` | Node field access |
| `grammar/index.ts` | 40 | `SUM_TYPES as Record<string, any>` | Schema polymorphism |

**Fixable with interface additions:**

| File | Line(s) | Cast | Fix |
|------|---------|------|-----|
| `equations.ts` | 90-91 | `(ctx.node as any).pos` | Already on `ASTNode` — ctx.node type needs narrowing |
| `equations.ts` | 113 | `sig.type as unknown as { children: KSNode[] }` | Add `KSLiteralType` interface |
| `frontend/convert.ts` | 56,59 | `(ksNode as any).leadingComments` | `KSNodeBase` already has these fields — need narrower cast |

### 3.4 `KSNodeBase` Index Signature

**Severity: Medium** | **File:** `grammar/derive.ts:92`

```typescript
export interface KSNodeBase extends ASTNode {
  [key: string]: unknown;
}
```

This allows arbitrary property access and mutation on any KS node.
Documented as needed for "structural cast compatibility" — specific node
interfaces (e.g., `KSVariableDeclaration`) are structural subtypes of `KSNodeBase`
because the index signature absorbs extra fields.

**Risk:** Misspelled field names won't produce type errors.

**Alternative:** `readonly [key: string]: unknown` would at least prevent mutation
while keeping structural compatibility.

### 3.5 Missing Specific Node Interfaces

**Severity: Low** | **File:** `specs/ts-ast/grammar/index.ts`

Only 17 of 364 node kinds have specific TypeScript interfaces. The rest fall
back to `KSNode & { kind: K }`. Equation functions that work with specific
nodes use `as any` casts instead of type guards.

Currently exported specific interfaces: `KSProgram`, `KSCompilationUnit`,
`KSIdentifier`, `KSVariableDeclaration`, `KSVariableStatement`,
`KSTypeAliasDeclaration`, `KSPropertySignature`, `KSTypeLiteral`,
`KSCallExpression`, `KSPropertyAccessExpression`, `KSNewExpression`,
`KSBinaryExpression`, `KSPrefixUnaryExpression`, `KSPostfixUnaryExpression`,
`KSImportDeclaration`, `KSExpressionStatement`, `KSStatement`.

Equation functions reference additional kinds (`KSLiteralType`, etc.) via
unsafe casts. Each frequently-cast kind should get a proper interface.

### 3.6 `validateDispatch` Not Called Automatically

**Severity: Medium** | **File:** `evaluator/engine.ts`

`validateDispatch()` is exported but not called inside `createEvaluator()` or
`wireEvaluator()`. The user-api composition root calls it manually
(`app/user-api/lib/program.ts:34`), but other composition roots might forget.

Should be called automatically inside `wireEvaluator()` since it has access
to both dispatch and spec attrs.

---

## 4. Separation of Concerns

### 4.1 `grammar/schema-utils.ts` Mixes Two Concerns

**File size:** ~430 lines, 13 exported functions

This file contains two distinct responsibility groups:

1. **Metadata computation** (pure, stateless):
   - `computeFieldDefs()`, `computeAllKinds()`, `computeSumTypeMembers()`
   - `computeKindMembership()`, `createTypeGuard()`
   - `propagateSumTypeFields()`, `createGrammarMetadata()`

2. **Tree operations** (serialization + construction):
   - `getChildren()`, `createNode()`
   - `nodeToJSON()`, `nodeFromJSON()`
   - `treeToJSON()`, `treeFromJSON()`

These could be split into `grammar/metadata.ts` and `grammar/tree-ops.ts`.
The barrel (`grammar/index.ts`) would re-export both — no downstream changes.

### 4.2 `equations.ts` Mixes Three Concerns

**File size:** 448 lines

1. **Constants and predicates** (lines 51-77): `ASSIGNMENT_OPS`, `IO_MODULES`,
   `SIDE_EFFECT_EXPR_KINDS` — violation detection vocabulary
2. **Definition extraction** (lines 96-145): `extractPropertiesFromTypeLiteral`,
   `tryExtractKindDef` — how Kind<...> type aliases become `KindDefinition`
3. **Attribute equations** (lines 149-449): equation functions + per-kind objects

Could be split into:
- `equations/predicates.ts` — violation detection constants
- `equations/definitions.ts` — Kind definition extraction
- `equations/attributes.ts` — equation functions and per-kind objects

### 4.3 Adapter Imports Bypass Barrels

Specs import directly from port internals rather than barrel re-exports:

```typescript
// specs/ts-ast/grammar/index.ts
import type { ASTNode, KSNodeBase, FieldDef, Grammar } from '../../../grammar/derive.js';
import type { GrammarMetadata } from '../../../grammar/schema-utils.js';

// Should import from barrel:
import type { ASTNode, KSNodeBase, FieldDef, Grammar, GrammarMetadata } from '../../../grammar/index.js';
```

This is widespread across `specs/`:
- `specs/ts-ast/grammar/index.ts` → imports from `grammar/derive.js` and `grammar/schema-utils.js`
- `specs/ts-ast/grammar/nodes.ts` → imports from `grammar/derive.js`
- `specs/ts-ast/frontend/convert.ts` → imports from `grammar/derive.js`
- `specs/ts-ast/kind-checking/equations.ts` → imports from `analysis/ctx.js` and `analysis/types.js`
- `specs/ts-ast/kind-checking/spec.ts` → imports from `analysis/types.js`, `analysis/pivot.js`, `analysis/ctx.js`
- `specs/mock/grammar/index.ts` → imports from `grammar/derive.js` and `grammar/schema-utils.js`
- `specs/mock/mock-analysis/spec.ts` → imports from `analysis/types.js`

These deep imports create coupling to the internal file structure of port modules.
If `grammar/derive.ts` were renamed or split, all spec imports would break.
Importing from barrels (`grammar/index.js`, `analysis/index.js`) would insulate
adapters from internal restructuring.

### 4.4 Example Code Imports from Adapter Internals

`examples/showcase.ts` imports directly from the adapter:

```typescript
import { frontend } from '../specs/ts-ast/frontend/convert.js';
import { extractASTData } from '../app/user-api/lib/export.js';
```

The `frontend` import bypasses the composition root entirely. Examples should
use the public API (`app/user-api/index.ts`) unless demonstrating adapter-level
usage intentionally.

### 4.5 `ports.ts` Missing `GeneratedImports`

The `GeneratedImports` interface is used at composition boundaries (codegen roots)
but is not re-exported from `ports.ts`. Add it for discoverability.

### 4.6 Module-Level Mutable State

Two instances, both acceptable but worth noting:

1. **`equations.ts:44`** — `let _counter: DefIdCounter = { value: 0 }`
   Reset by `resetCounter()` (called by evaluator setup hook). Properly scoped.

2. **`convert.ts:89`** — `const specificConverters: Partial<Record<number, SpecificConverter>> = {}`
   Populated during module load via `register()`, then read-only. Effectively static configuration.

---

## 5. Redundancy and Dead Code

### 5.1 No Dead Exports Found

All public exports from port modules, adapters, and composition roots are consumed
by at least one test or production module. No orphaned functions or types detected.

### 5.2 Barrel Re-Export Consistency

All barrels (`grammar/index.ts`, `analysis/index.ts`, `evaluator/index.ts`) correctly
re-export their contents. No missing or spurious exports found, except:

- `GeneratedImports` missing from `ports.ts` (see 4.5)

### 5.3 Test Redundancy

Several test files cover overlapping ground:

| Overlap | Assessment |
|---------|-----------|
| `definitions.test.ts` (11) + `kind-checking.test.ts` (11) | Both test `kindDefs` attribute; kind-checking is broader. `definitions.test.ts` could be merged in. |
| `stamped-fields.test.ts` (17) + `integration.test.ts` (25) | Both verify converted AST field correctness. Integration covers all 13 field categories; stamped-fields is a subset. |
| `violations.test.ts` (16) + `e2e.test.ts` (16) | Both are full-pipeline end-to-end. Violations focuses on checker properties; e2e is more general. |
| `serialize.test.ts` (9) + `schema-serialize.test.ts` (22) | Both test serialization but at different levels (pipeline vs. builder). Acceptable separation. |

### 5.4 No Circular Dependencies

Confirmed zero circular imports across the entire codebase using import chain analysis.
The layering `grammar → analysis → evaluator` is strictly enforced.

---

## 6. Filesystem Structure Analysis

### 6.1 Current Structure

```
ksc/
├── ports.ts                    ← port re-exports (good)
├── grammar/                    ← port: grammar types + runtime utilities
│   ├── derive.ts               ← port interfaces
│   ├── schema-utils.ts         ← metadata + serialization + tree ops (mixed)
│   └── index.ts                ← barrel
├── analysis/                   ← port: analysis types + compilation
│   ├── types.ts                ← port interfaces + factory functions (mixed)
│   ├── ctx.ts                  ← port interface
│   ├── compile.ts              ← machinery
│   ├── validate.ts             ← machinery
│   ├── pivot.ts                ← machinery
│   └── index.ts                ← barrel
├── evaluator/                  ← port: evaluator engine
│   ├── types.ts                ← port interfaces
│   ├── engine.ts               ← machinery
│   └── index.ts                ← barrel
├── specs/                      ← adapters
│   ├── ts-ast/
│   │   ├── grammar/            ← Grammar<TSNodeKind>
│   │   ├── frontend/           ← Frontend<ts.Program, KSProgram>
│   │   └── kind-checking/      ← AnalysisSpec<TSNodeKind, KSCProjections>
│   └── mock/
│       ├── grammar/            ← Grammar<MockKind>
│       └── mock-analysis/      ← AnalysisSpec<MockKind, MockProjections>
├── app/                        ← composition roots
│   ├── cli/
│   ├── user-api/
│   └── analysis-codegen/
├── generated/                  ← codegen output (committed)
├── test/                       ← all tests (flat)
├── examples/                   ← usage examples
└── docs/                       ← documentation
```

### 6.2 Issues with Current Layout

**Issue 1: `analysis/types.ts` mixes port interfaces and factory functions**

`analysis/types.ts` (242 lines) contains:
- Port interfaces: `AnalysisSpec`, `AttrDecl`, `CodegenTarget`, `GeneratedImports`
- Supporting types: `AttrExpr`, `CodeLiteral`, `ParamDef`, `SynAttr`, `InhAttr`, `CollectionAttr`
- Factory functions: `code()`, `isCodeLiteral()`, `withDeps()`, `collectDepsForAttr()`
- Output types: `CompiledAnalyzer`, `CompiledAttrDef`, `GeneratedFile`, `AttributeDepGraph`

The factory functions (`withDeps`, `code`) are used by adapter authors writing
equations. They're not port interfaces — they're utilities. Consider:
- Port interfaces → `analysis/types.ts` (pure interfaces)
- Equation utilities → `analysis/equation-utils.ts` (`code`, `withDeps`, `collectDepsForAttr`)
- Codegen output types → `analysis/compile-types.ts` (`CompiledAnalyzer`, `GeneratedFile`)

**Issue 2: Tests are flat in `test/`**

All 25 test files sit in a single directory without organizational hierarchy.
The architectural layers are:
- 6 files test ports
- 7 files test adapters
- 2 files test codegen
- 10 files test composition roots / e2e

A hierarchy like `test/ports/`, `test/adapters/`, `test/e2e/` would mirror
the source architecture and make it clearer which layer each test validates.

**Issue 3: `grammar/derive.ts` exports both ports and non-port types**

This file exports port interfaces (`ASTNode`, `FieldDef`, `Grammar`, `Frontend`)
alongside grammar-specific base types (`KSNodeBase`, `KSCommentRange`) and
schema shapes (`NodeDefShape`, `SumTypeDefShape`, `FieldDescShape`).

`KSNodeBase` is a concrete type used by adapters, not a port contract.
`NodeDefShape`/`SumTypeDefShape`/`FieldDescShape` are validation shapes for
`as const satisfies` — adapter authoring utilities, not ports.

Consider splitting:
- `grammar/ports.ts` — `ASTNode`, `FieldDef`, `Grammar<K>`, `Frontend<I,R,O>`
- `grammar/base-types.ts` — `KSNodeBase`, `KSCommentRange`
- `grammar/schema-shapes.ts` — `NodeDefShape`, `SumTypeDefShape`, `FieldDescShape`

### 6.3 Proposed Refined Structure

This structure separates ports from machinery more explicitly and adds sub-organization
to the flat test directory:

```
ksc/
├── ports.ts                       (unchanged — re-exports all port interfaces)
│
├── grammar/
│   ├── ports.ts                   ← ASTNode, FieldDef, Grammar<K>, Frontend<I,R,O>
│   ├── base-types.ts              ← KSNodeBase, KSCommentRange
│   ├── schema-shapes.ts           ← NodeDefShape, SumTypeDefShape, FieldDescShape
│   ├── metadata.ts                ← computeFieldDefs, computeAllKinds, propagateSumTypeFields, ...
│   ├── tree-ops.ts                ← getChildren, createNode, serialization
│   └── index.ts                   ← barrel
│
├── analysis/
│   ├── ports.ts                   ← AnalysisSpec, AttrDecl, CodegenTarget, GeneratedImports, Ctx, KindCtx
│   ├── equation-utils.ts          ← code(), withDeps(), collectDepsForAttr()
│   ├── compile.ts                 ← compileAnalysis, buildDepGraph (machinery)
│   ├── compile-types.ts           ← CompiledAnalyzer, GeneratedFile, CompiledAttrDef
│   ├── validate.ts                ← validateSpec
│   ├── pivot.ts                   ← pivotToAttrCentric
│   └── index.ts                   ← barrel
│
├── evaluator/
│   ├── ports.ts                   ← DispatchConfig, EvaluatorConfig, TypedAGNode, EvaluationTarget, ...
│   ├── engine.ts                  ← AGNode, createEvaluator, wireEvaluator
│   └── index.ts                   ← barrel
│
├── specs/                         (unchanged)
│
├── app/                           (unchanged)
│
├── test/
│   ├── ports/                     ← schema-utils, evaluator, compile-analysis, validate, pivot
│   ├── adapters/                  ← builders, node-schema, convert-helpers, convert, grammar-coverage
│   ├── integration/               ← integration, stamped-fields, kind-checking, definitions, mock-evaluator
│   ├── e2e/                       ← e2e, violations, serialize
│   ├── codegen/                   ← codegen-scripts, codegen-mock
│   ├── api/                       ← program, config, cli, export
│   └── type-safety/               ← type-safety
```

**Migration cost:** Medium. All barrels would need updating, and downstream imports
through barrels would remain stable. Direct imports from spec files would need
path updates.

**Note:** This is a suggestion, not a prescription. The current flat structure
works and is well-documented in CLAUDE.md. The proposed structure would
make the ports/machinery/shapes distinction more explicit in the filesystem.

---

## 7. Test Suite Analysis

### 7.1 Coverage Summary

| Category | Files | Tests | % |
|----------|-------|-------|---|
| Port machinery | 6 | 68 | 19.8% |
| Adapters (TS-AST) | 6 | 106 | 30.8% |
| Adapters (Mock) | 1 | 6 | 1.7% |
| Evaluator wiring | 3 | 28 | 8.1% |
| Composition roots / API | 8 | 97 | 28.2% |
| Codegen | 2 | 8 | 2.3% |
| Type safety | 1 | 4 | 1.2% |
| **Total** | **25** | **344** | **100%** |

### 7.2 Coverage Gaps

1. **No isolated tests for equation functions** — each equation in `equations.ts`
   is tested only indirectly through full evaluator integration tests
2. **No tests for `analysis/ctx.ts`** — `Ctx` and `KindCtx<N>` are tested only
   through evaluator wiring
3. **No performance baseline tests**
4. **No roundtrip codegen test** — no test that regenerates dispatch and then
   runs evaluator tests against fresh output

### 7.3 Test Organization vs Architecture

Tests don't mirror the architectural layers:
- Port tests and adapter tests are mixed in the same flat directory
- Integration tests and e2e tests are indistinguishable by name
- `codegen-scripts.test.ts` name doesn't indicate which composition root it tests

### 7.4 Fixture Organization

Fixtures live in `test/fixtures/` organized by scenario:
- `kind-basic/`, `kind-violations/`, `checker-properties/`, `checker-violations/`,
  `checker-dir-clean/`, `checker-dir-violations/`, `checker-edges/`, `integration/`

This is fine — fixtures are test-specific, not source-specific.

---

## 8. Recommendations

### Priority 0 — Quick Wins (Low Risk, High Value)

1. **Replace `as any` with `as Record<string, unknown>` where possible**
   Files: `grammar/schema-utils.ts`, `evaluator/engine.ts` (6 casts)
   Why: Same runtime behavior, eliminates unnecessary `any` escape hatch

2. **Add `GeneratedImports` to `ports.ts` re-exports**
   Why: Used at composition boundaries, should be discoverable

3. **Call `validateDispatch()` inside `wireEvaluator()`**
   Why: Prevents composition roots from forgetting validation

4. **Make `KSNodeBase` index signature readonly**
   Change: `readonly [key: string]: unknown`
   Why: Nodes should be immutable after construction

### Priority 1 — Type Safety (Medium Effort)

5. **Add K parameter to `EvaluatorConfig`**
   Change: `EvaluatorConfig<K, P>` with `grammar: Grammar<K>`
   Why: Closes the K-linking gap between `wireEvaluator` and `createEvaluator`

6. **Add specific node interfaces for frequently-cast kinds**
   Add: `KSLiteralType`, and any other kind used in `equations.ts` casts
   Why: Eliminates unsafe casts in equation logic

7. **Formalize equation function type**
   Add: `interface EquationFn extends Function { deps?: string[] }`
   Why: Eliminates `as any` in `withDeps()` and `collectDepsForAttr()`

### Priority 2 — Separation of Concerns (Medium Effort)

8. **Split `grammar/schema-utils.ts`** into metadata computation and tree operations
   Why: Two distinct responsibilities in one 430-line file

9. **Split `equations.ts`** into predicates, definition extraction, and attributes
   Why: Three distinct concerns in one 448-line file

10. **Route spec imports through barrels** instead of internal port files
    Why: Decouples adapters from port internal file structure

11. **Split `analysis/types.ts`** — separate port interfaces from equation utilities
    and codegen output types
    Why: Port interfaces, adapter utilities, and codegen types serve different audiences

### Priority 3 — Organization (Higher Effort)

12. **Organize tests into subdirectories** mirroring architectural layers
    Why: Makes test coverage per layer visible at a glance

13. **Consider merging `definitions.test.ts` into `kind-checking.test.ts`**
    Why: Overlapping coverage of the same attribute

14. **Split `grammar/derive.ts`** — separate port contracts from base types and schemas
    Why: Port interfaces should be in a file named for what they are

### Not Recommended

- **Do not parameterize `DispatchConfig` by K** — the dispatch config is a runtime
  Record and K doesn't add value at the dispatch level. K-linking belongs at
  `EvaluationTarget` and `EvaluatorConfig` level.

- **Do not add exhaustiveness checking for `SynAttr` equations** at the type level —
  the runtime validation in `compileAnalysis` already catches missing equations.
  The type system can't express "if default is omitted, equations must be exhaustive"
  without complex conditional types.

- **Do not restructure the filesystem** unless there's a compelling reason beyond
  aesthetics. The current flat structure is well-documented in CLAUDE.md and all
  port boundaries are properly enforced.

---

## 9. Implementation Progress

All recommendations from this review have been implemented. 344 tests pass across 24 test files.

### P0 — Quick Wins: All Complete

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Replace `as any` with narrower types | **Done** | Introduced `IndexedNode = ASTNode & { readonly [key: string]: unknown }` pattern in `evaluator/engine.ts` and `grammar/tree-ops.ts`. Replaced `as any` with `as Record<string, NodeDefShape>` in `grammar/metadata.ts`. Replaced `(k.properties as any)[property]` with `as Record<string, boolean \| undefined>` in `equations/attributes.ts`. Removed unnecessary casts where ASTNode already has the field (`.pos`, `.end`, `.expression.kind`). |
| 2 | Add `GeneratedImports` to `ports.ts` | **Done** | Added to the codegen target re-exports: `export type { CodegenTarget, GeneratedImports } from './analysis/types.js'` |
| 3 | Call `validateDispatch()` inside `wireEvaluator()` | **Done** | `wireEvaluator()` now calls `validateDispatch(opts.dispatch, opts.spec.attrs.map(a => a.name))` automatically. Removed manual call from `app/user-api/lib/program.ts`. |
| 4 | Make `KSNodeBase` index signature readonly | **Done** | Changed to `readonly [key: string]: unknown` in `grammar/base-types.ts`. |

### P1 — Type Safety: All Complete

| # | Item | Status | Notes |
|---|------|--------|-------|
| 5 | Add K parameter to `EvaluatorConfig` | **Done** | `EvaluatorConfig<K extends string = string, P>` with `grammar: Grammar<K>`. Updated `createEvaluator<K, M, P>` signature to match. K-linking now flows through `wireEvaluator → createEvaluator`. |
| 6 | Add specific node interfaces for frequently-cast kinds | **Done** | Added `KSLiteralType` interface to `specs/ts-ast/grammar/index.ts`. Used in equation code instead of `as unknown as { children: KSNode[] }`. |
| 7 | Formalize equation function type | **Done** | Created `EquationFn` interface in `analysis/equation-utils.ts`. `withDeps()` and `collectDepsForAttr()` use `(fn as EquationFn).deps` instead of `(fn as any).deps`. Note: `withDeps` constraint must remain `(...args: any[]) => any` due to TypeScript function variance rules. |

### P2 — Separation of Concerns: All Complete

| # | Item | Status | Notes |
|---|------|--------|-------|
| 8 | Split `grammar/schema-utils.ts` | **Done** | Split into `grammar/metadata.ts` (pure metadata computation) and `grammar/tree-ops.ts` (tree operations + serialization). Barrel updated. |
| 9 | Split `equations.ts` | **Done** | Split into directory: `equations/predicates.ts`, `equations/definitions.ts`, `equations/attributes.ts`, `equations/index.ts` (barrel). |
| 10 | Route spec imports through barrels | **Done** | All `specs/` files updated to import from `grammar/index.js` and `analysis/index.js` instead of internal files (`grammar/derive.js`, `analysis/types.js`, etc.). All test files similarly updated. |
| 11 | Split `analysis/types.ts` | **Done** | Extracted equation utilities (`withDeps`, `collectDepsForAttr`, `EquationFn`) to `analysis/equation-utils.ts`. Port interfaces remain in `types.ts`. Re-exported through `analysis/index.ts` barrel. |

### P3 — Organization: All Complete

| # | Item | Status | Notes |
|---|------|--------|-------|
| 12 | Organize tests into subdirectories | **Done** | Tests organized into: `test/ports/` (5 files), `test/adapters/` (7 files), `test/integration/` (3 files), `test/e2e/` (3 files), `test/codegen/` (2 files), `test/api/` (4 files), `test/type-safety/` (1 file). Vitest config updated for new paths. |
| 13 | Merge `definitions.test.ts` into `kind-checking.test.ts` | **Done** | All 11 binder attribute test blocks merged into `kind-checking.test.ts` (now 22 tests). `definitions.test.ts` deleted. |
| 14 | Split `grammar/derive.ts` | **Done** | Split into `grammar/ports.ts` (ASTNode, FieldDef, Grammar, Frontend), `grammar/base-types.ts` (KSNodeBase, KSCommentRange), `grammar/schema-shapes.ts` (NodeDefShape, SumTypeDefShape, FieldDescShape). Barrel updated. |

### Files Created
- `grammar/ports.ts` — port interfaces
- `grammar/base-types.ts` — concrete base types
- `grammar/schema-shapes.ts` — schema validation shapes
- `grammar/metadata.ts` — pure metadata computation
- `grammar/tree-ops.ts` — tree operations + serialization
- `analysis/equation-utils.ts` — equation function utilities
- `specs/ts-ast/kind-checking/equations/predicates.ts` — violation constants
- `specs/ts-ast/kind-checking/equations/definitions.ts` — Kind definition extraction
- `specs/ts-ast/kind-checking/equations/attributes.ts` — equation functions
- `specs/ts-ast/kind-checking/equations/index.ts` — equations barrel

### Files Deleted
- `grammar/derive.ts` (split into 3 files)
- `grammar/schema-utils.ts` (split into 2 files)
- `specs/ts-ast/kind-checking/equations.ts` (split into directory)
- `test/integration/definitions.test.ts` (merged into kind-checking.test.ts)

### Key Patterns Introduced
- **`IndexedNode`** — `ASTNode & { readonly [key: string]: unknown }` — reusable intersection type for dynamic field access without `as any`
- **`EquationFn`** — `interface EquationFn { (...args: unknown[]): unknown; deps?: string[] }` — formalized deps metadata pattern
