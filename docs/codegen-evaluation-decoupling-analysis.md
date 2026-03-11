# Codegen / Evaluation Decoupling Analysis

## 1. The Two Applications

KindScript contains two logically independent applications inside a single codebase:

**Application A — Codegen**: Takes a grammar + analysis specification (attribute declarations with equation functions), validates them, and generates TypeScript dispatch files, attribute type maps, and dependency graphs.

**Application B — Evaluation**: Takes a TypeScript project, converts it to a KS AST, builds an AG tree decorated with caching/cycle-detection, runs generated dispatch functions to evaluate attributes, and extracts projections (kind definitions, diagnostics).

These two applications share some types and interfaces but have fundamentally different runtime dependency graphs. The generated files are the artifact boundary: codegen produces them, evaluation consumes them.

---

## 2. Implementation Status

All changes have been implemented. The codegen and evaluation concerns are now physically separated into independent npm workspace packages with strict enforcement via Node.js module resolution.

### Changes Completed

| # | Change | Status |
|---|--------|--------|
| 1 | Remove `wireEvaluator` from engine.ts | **Done** — removed from engine.ts and barrel. Mock test updated to use `createEvaluator`. |
| 2 | Remove `EvaluationTarget` from ports.ts | **Done** — removed from ports.ts and barrel. No consumers remain. |
| 3 | Remove `AnalysisSpec` from analysis ports | **Done** — removed from ports.ts and barrel. Mock spec now exports `analysisDecl` + `analysisProjections` separately. |
| 4 | Create workspace packages | **Done** — three npm workspace packages created (see below). |
| 5 | Move `AnalysisDecl`, `AttrDecl`, `AttrExpr`, `CodeLiteral` to codegen package | **Done** — now in `packages/core-codegen/src/ports.ts`. |
| 6 | Split analysis barrel | **Done** — `src/core/analysis/index.ts` is now a thin re-export layer forwarding to packages. |
| 7 | Update evaluator to import `Ctx` directly | **Done** — evaluator package imports `Ctx` from its own `ctx.ts`, no analysis barrel dependency. |
| 8 | Update mock test to use `createEvaluator` | **Done** — mock-evaluator.test.ts calls `createEvaluator` with explicit `{ grammar, dispatch, projections, setup }`. |

### Verification

- **Typecheck**: Clean (`tsc --noEmit` passes)
- **Tests**: All 388 tests pass (28 test files)
- **Package boundaries**: Zero cross-imports between core-codegen and core-evaluator (verified by grep)

---

## 3. Workspace Package Structure

### Package Dependency Graph

```
@kindscript/core-grammar      ← leaf package (no @kindscript deps)
@kindscript/core-codegen       → @kindscript/core-grammar only
@kindscript/core-evaluator     → @kindscript/core-grammar only
kindscript (root)              → all three packages
```

**Enforcement**: `core-evaluator` cannot import from `core-codegen` (and vice versa) because neither declares the other as a dependency in its `package.json`. Any attempt to import would fail at both TypeScript typecheck and Node.js runtime.

### `packages/core-grammar/` — Shared Grammar Types

```
packages/core-grammar/
  package.json                 @kindscript/core-grammar (no deps)
  tsconfig.json
  src/
    ports.ts                   Grammar<K>, ASTNode, FieldDef, AstTranslatorPort
    base-types.ts              KSNodeBase, KSCommentRange
    schema-shapes.ts           NodeDefShape, SumTypeDefShape, FieldDescShape
    metadata.ts                createGrammarMetadata(), computeFieldDefs(), etc.
    tree-ops.ts                getChildren(), createNode(), serialization
    index.ts                   Barrel
```

### `packages/core-codegen/` — Codegen Machinery

```
packages/core-codegen/
  package.json                 @kindscript/core-codegen → core-grammar
  tsconfig.json
  src/
    ports.ts                   AnalysisDecl<K>, AttrDecl<K>, AttrExpr, CodeLiteral, code()
    dep-graph-types.ts         AttributeDepGraph (pure data, shared via re-export)
    codegen-types.ts           CodegenTarget<K>, GeneratedImports, CompiledAnalyzer
    compile.ts                 compileAnalysis(), buildDepGraph(), validateSpecConsistency()
    validate.ts                validateSpec()
    pivot.ts                   pivotToAttrCentric()
    equation-utils.ts          withDeps(), collectDepsForAttr()
    index.ts                   Barrel
```

### `packages/core-evaluator/` — Evaluator Engine + Runtime Analysis

```
packages/core-evaluator/
  package.json                 @kindscript/core-evaluator → core-grammar
  tsconfig.json
  src/
    ctx.ts                     Ctx, KindCtx (equation function context)
    analysis-ports.ts          AnalysisProjections<P> (runtime analysis interface)
    engine.ts                  AGNode, createEvaluator(), validateDispatch(), Evaluator<M,P>
    ports.ts                   DispatchConfig, EvaluatorConfig, TypedAGNode, AGNodeInterface
    index.ts                   Barrel
```

### `src/core/` — Thin Re-export Layer

```
src/core/
  grammar/                     Re-exports from @kindscript/core-grammar
  analysis/                    Re-exports from @kindscript/core-codegen + @kindscript/core-evaluator
  evaluator/                   Re-exports from @kindscript/core-evaluator
```

All existing imports from adapters, application layer, wiring, and tests continue to work unchanged — `src/core/` files are now thin re-export modules that forward to the workspace packages.

---

## 4. Design Decisions Made

### Decision 1: Remove `AnalysisSpec<K, P>` — **Done (Option A)**

The combined interface was removed entirely. `AnalysisDecl<K>` (codegen-time) and `AnalysisProjections<P>` (runtime) are now fully independent interfaces in separate packages. The mock adapter exports both separately.

### Decision 2: Remove `wireEvaluator` — **Done (Option A)**

Removed from `engine.ts`. All call sites now use `createEvaluator` directly. The dispatch validation (`validateDispatch`) remains available as a standalone utility but is no longer called implicitly.

### Decision 3: Remove `EvaluationTarget<K, P>` — **Done (Option A)**

Removed from `ports.ts`. `EvaluatorConfig<K, P>` is the canonical interface for what `createEvaluator` needs.

### Decision 4: Split into workspace packages — **Done (Option B from original doc)**

Instead of directory-level separation (Option A), workspace packages provide strict physical enforcement via Node.js module resolution. Three packages: `core-grammar` (shared), `core-codegen` (codegen), `core-evaluator` (evaluation).

### Decision 5: Move codegen types to codegen package — **Done (Option A)**

`AnalysisDecl`, `AttrDecl`, `AttrExpr`, `CodeLiteral`, `code()`, `isCodeLiteral()` now live in `packages/core-codegen/src/ports.ts`.

### Decision 6: `AttributeDepGraph` placement — **Codegen package with re-export**

`AttributeDepGraph` lives in `packages/core-codegen/src/dep-graph-types.ts` since codegen computes it. It's re-exported through `src/core/analysis/ports.ts` so existing runtime consumers (application layer, generated dep-graph.ts) can access it without importing from the codegen package.

### Decision 7: Evaluator imports `Ctx` directly — **Done (Option A)**

The evaluator package defines its own `ctx.ts` with `Ctx` and `KindCtx`. No analysis barrel imports. The evaluator's `ports.ts` imports `Ctx` from its local `./ctx.ts`.

### Decision 8: Evaluator imports — **No analysis barrel dependency**

The evaluator package has zero imports from `@kindscript/core-codegen` and zero imports from any analysis barrel. Its only external dependency is `@kindscript/core-grammar`.

### Decision 9: Equations — **Kept as-is (Option A)**

Equations remain in `src/adapters/analysis/spec/ts-kind-checking/equations/`. They are runtime code that codegen introspects — the standard compiler pattern.

### Decision 10: Workspace packages — **Done (Option B)**

Three npm workspace packages enforce the boundary physically. Any accidental cross-import fails at both typecheck and runtime.

---

## 5. Import Rule Enforcement

The following rules are enforced by npm workspace package resolution:

```
@kindscript/core-evaluator  → can import: @kindscript/core-grammar
                            → CANNOT import: @kindscript/core-codegen (not in package.json deps)

@kindscript/core-codegen    → can import: @kindscript/core-grammar
                            → CANNOT import: @kindscript/core-evaluator (not in package.json deps)

@kindscript/core-grammar    → no @kindscript imports (leaf package)
```

Verified import directions:

| Package | Imports from core-grammar | Imports from core-codegen | Imports from core-evaluator |
|---------|:-------------------------:|:-------------------------:|:---------------------------:|
| core-grammar | — | — | — |
| core-codegen | `Grammar` (type) | — | — |
| core-evaluator | `ASTNode`, `FieldDef`, `Grammar` (types) | — | — |
