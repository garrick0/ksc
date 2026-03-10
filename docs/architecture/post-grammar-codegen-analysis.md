# Post-Grammar-Codegen Architecture Analysis

**Date**: 2026-03-09
**Context**: Grammar codegen has been fully eliminated. The system now has a single codegen step (analysis compilation). This document analyzes the current architecture for overlap, dead code, boundary issues, and opportunities to make the pipeline stages more explicit.

> **Note**: This document was written before the evaluator separation refactoring. References to `evaluator.ts` (generated) and `KSCDNode` are outdated. The evaluator is now hand-written in `evaluator/engine.ts`; codegen produces `dispatch.ts` instead. See `evaluator-separation-analysis.md` for details.

---

## 1. Pipeline Stages — IMPLEMENTED

Two explicit composition roots model the full pipeline:

### Codegen Composition Root (`app/analysis-codegen/ts-kind-checking.ts`)

Build-time pipeline: grammar → spec → codegen. Each stage is an explicit import + parameter.

```
Stage 1: Grammar         createTSASTGrammar() → GrammarMetadata (364 kinds, 48 sum types)
Stage 2: Spec            analysisSpec (8 attrs, projections, grammarConfig)
Stage 3: Codegen         runCodegenCLI(pipeline) → evaluator.ts + attr-types.ts
```

The `CodegenPipeline` interface (`app/analysis-codegen/lib/pipeline.ts`) requires both `grammar` and `spec`, making the grammar→spec dependency visible at the root level.

### Evaluation Composition Root (`app/user-api/lib/program.ts`)

Runtime pipeline: frontend → evaluation. Defined as an `EvaluationPipeline` object.

```
Stage 1: Convert         pipeline.convert(tsProgram, depth) → KSTree
Stage 2: Evaluate        pipeline.evaluate(ksTree.root) → { definitions, diagnostics }
```

The `EvaluationPipeline` interface (`app/user-api/lib/types.ts`) types the two stages explicitly. The pipeline object is constructed from the concrete TS AST frontend and compiled evaluator.

### Other entry points

- `app/cli/cli.ts` → delegates to `program.ts` (evaluation root)
- `app/user-api/lib/parse.ts` — convert-only path (no evaluation stage)
- `app/analysis-codegen/mock.ts` — codegen root for mock spec (same pattern)

---

## 2. Dead Code and Empty Directories

### 2.1 `specs/ts-ast/frontend/extractors.ts` — vestigial from grammar codegen

**Status**: Only imported by `test/field-extractors.test.ts`. No production code uses it.

**Evidence**: `extractors.ts` exports `buildFieldExtractors()` which returns **string expressions** like `'isImportReference(_ctx, node)'` and `'getTypeString(_ctx, node)'`. These were designed for codegen — the old grammar codegen would embed these strings into generated converter code.

Now `convert.ts` is hand-written and uses **actual function calls** via `CUSTOM_EXTRACTORS` (function-valued, not string-valued). The same data exists in two representations:

| Data | `extractors.ts` (dead) | `convert.ts` (live) |
|------|----------------------|-------------------|
| Identifier fields | String expressions: `'hasSymFlag(_ctx, node, ts.SymbolFlags.Variable)'` | Functions: `(ctx, _n, node) => hasSymFlag(ctx, node, ts.SymbolFlags.Variable)` |
| SKIP_CONVERT | `new Set(['Program', 'CompilationUnit'])` | `new Set(['Program', 'CompilationUnit'])` |
| EXPORTED_DECLARATION_KINDS | `const [] as const` | `new Set([...])` |
| SCOPE_CONTAINER_KINDS | `const [] as const` | `new Set([...])` |

**Recommendation**: Delete `extractors.ts` and `test/field-extractors.test.ts`. The test is testing a function that nothing uses. The data it tested is now live in `convert.ts` and tested through the e2e and convert-helpers tests.

### 2.2 `app/grammar-codegen/` — empty directory

Git status shows `?? app/grammar-codegen/` as untracked with no .ts files inside. This was presumably created for the grammar codegen that was later eliminated.

**Recommendation**: Delete the empty directory.

### 2.3 `specs/mock/frontend/` — empty directory

Git status shows `?? specs/mock/frontend/` as untracked with no files. The mock grammar has no frontend (it creates nodes directly in tests).

**Recommendation**: Delete the empty directory. The mock spec doesn't need a frontend — test nodes are created via `createNode()`.

### 2.4 `GeneratedFile` in `grammar/derive.ts` — orphaned from grammar codegen

`GeneratedFile` is defined in `grammar/derive.ts:98` and re-exported from `grammar/index.ts`. This was used by the old grammar codegen to represent generated files. Now:
- `analysis/types.ts` defines its own identical `GeneratedFile` (intentionally, to avoid grammar/ dependency)
- `app/analysis-codegen/lib/pipeline.ts` imports from `analysis/types.ts`
- No production code imports `GeneratedFile` from `grammar/`

**Recommendation**: Remove `GeneratedFile` from `grammar/derive.ts` and `grammar/index.ts`. It's a codegen output concept, not a grammar type concept. The analysis module's copy is the only one in use.

---

## 3. Duplication

### 3.1 `AnalysisDepth` defined twice

- `specs/ts-ast/frontend/helpers.ts:16`: `export type AnalysisDepth = 'parse' | 'bind' | 'check';`
- `specs/ts-ast/frontend/convert.ts:28`: `export type AnalysisDepth = 'parse' | 'bind' | 'check';`

Additionally, `app/user-api/lib/config.ts` uses the same union inline: `readonly analysisDepth?: 'parse' | 'bind' | 'check'`.

**Recommendation**: Define `AnalysisDepth` once in `helpers.ts` (which it already does), import it in `convert.ts`. Consider whether `config.ts` should also import it, or whether the inline union is acceptable for an app-level interface.

### 3.2 `ConvertContext` — two versions

- `specs/ts-ast/frontend/helpers.ts:19-22`: `{ checker, depth }` — minimal context for helper functions
- `specs/ts-ast/frontend/convert.ts:31-35`: `{ checker, depth, tsToKs }` — full context with WeakMap

The helpers version is a strict subset. Helper functions only need checker and depth, not the WeakMap.

**Recommendation**: Make helpers import the `AnalysisDepth` type from a single source. The two `ConvertContext` versions serve different purposes (the helpers version is deliberately minimal for testability) — this is acceptable. However, if `ConvertContext` in helpers is never used directly by external callers, consider defining it as a minimal interface in helpers and having convert.ts extend it:

```typescript
// helpers.ts
export interface ConvertContextBase { checker: ts.TypeChecker | undefined; depth: AnalysisDepth; }

// convert.ts
interface ConvertContext extends ConvertContextBase { tsToKs: WeakMap<ts.Node, KSNode>; }
```

This eliminates the AnalysisDepth duplication as a side effect.

### 3.3 Two `validateSpec` functions

- `analysis/validate.ts:20`: `validateSpec(spec: AnalysisSpec): ValidationDiagnostic[]` — runtime validation of attribute dependency consistency
- `analysis/compile.ts:602`: `function validateSpec(spec: AnalysisSpec, attrs: AttrDecl[]): void` — codegen-time validation of kind references, function names, and exhaustiveness

Both are called during the codegen pipeline — validate.ts's version by `pipeline.ts`, and compile.ts's version internally.

**Problem**: Same name, different signatures, different purposes, different locations. The compile.ts one throws on error; the validate.ts one returns diagnostics.

**Recommendation**: Rename the compile.ts internal function to `validateSpecForCodegen` to distinguish it. Alternatively, merge both validations into a single pass in compile.ts, returning diagnostics rather than throwing, and remove the separate `validate.ts` module. The validate.ts module is only 39 lines and its functionality could be absorbed into compile.ts's validation.

---

## 4. Boundary and Dependency Issues

### 4.1 `analysis/ctx.ts` imports from `grammar/derive.ts`

```typescript
// analysis/ctx.ts line 9
import type { ASTNode } from '../grammar/derive.js';
```

CLAUDE.md states: *"analysis/ — Analysis machinery. **Fully generic — no spec or grammar imports.**"*

This is the only import from grammar/ in the entire analysis/ directory. It's a type-only import of `ASTNode` (a 5-field generic interface: kind, pos, end, text, children). The import is used to type `Ctx.node` and `KindCtx<N>`.

**Options**:
1. **Accept the dependency** — `ASTNode` is infrastructure, not spec-specific. Update CLAUDE.md to say "no spec imports" instead of "no spec or grammar imports."
2. **Inline a minimal contract** — Define `interface CtxNode { kind: string; [key: string]: unknown }` in ctx.ts. This makes analysis/ truly standalone but loses the structural documentation that ASTNode provides.
3. **Extract a shared contract type** — Move `ASTNode` to a tiny shared module (e.g., `contracts/ast-node.ts`) that both grammar/ and analysis/ can import from.

**Recommendation**: Option 1. The ASTNode import is a generic contract type, and grammar/ is generic infrastructure (not spec-specific). The CLAUDE.md wording should be updated to reflect the actual (and reasonable) dependency.

### 4.2 Spec-provided evaluateBody is stringly-typed codegen

`AnalysisSpec.evaluatorSetup.evaluateBody` returns `string[]` — raw TypeScript code lines that get spliced into the generated evaluator. This works but means the spec's evaluation entry point is:
- Not type-checked until the generated file is compiled
- Not refactorable by IDE tools
- A code template, not a function

This is a known tradeoff of the codegen approach and unlikely to change, but worth noting as a boundary where type safety breaks down.

---

## 5. Vestigial Naming

### 5.1 "Functor 2" and "Cross-Functor" nomenclature

With grammar codegen eliminated, the "two-functor" framing is obsolete. Remnants:

| File | Line | Text |
|------|------|------|
| `analysis/compile.ts` | 3 | `Functor 2: Analysis Compilation` |
| `app/analysis-codegen/lib/pipeline.ts` | 4 | `Functor 2` in module doc |
| `app/analysis-codegen/lib/pipeline.ts` | 40 | `console.log('=== Cross-Functor Validation ===\n')` |
| `app/analysis-codegen/lib/pipeline.ts` | 55 | `console.log('\n=== Functor 2: Analysis Compilation ===\n')` |

**Recommendation**: Remove "Functor 2" references. Use "Analysis Compilation" or "Analysis Codegen" instead. Change "Cross-Functor Validation" to "Spec Validation" or "Pre-Compilation Validation."

---

## 6. Structural Observations

### 6.1 `analysis/validate.ts` is minimal (39 lines, one function)

The module checks one thing: that all attribute dependency names reference existing attributes. This is useful but tiny. It's separately imported by `pipeline.ts` and has its own test file.

Given the existence of the internal `validateSpec` in `compile.ts` (which does 4 additional checks), there's a question of whether validate.ts should be merged into compile.ts or whether the separation adds value.

**Current flow**:
```
pipeline.ts → validate.ts/validateSpec()  → attr dep consistency
            → compile.ts/compileAnalysis() → internal validateSpec() → kind refs, fn names, exhaustiveness
```

**Observation**: The two-step validation is an artifact of the old architecture where validation happened between functor 1 (grammar) and functor 2 (analysis). Now that there's only one codegen step, both validations could be a single pre-flight check inside `compileAnalysis()`.

### 6.2 `analysis/pivot.ts` is minimal (34 lines, one function)

`pivotToAttrCentric()` is a pure data reshape (production-centric → attr-centric). It's only used by `specs/ts-ast/kind-checking/spec.ts`. It could live in the spec, in analysis/types.ts, or where it is. Current location is fine — it's a generic utility that any spec could use.

### 6.3 The pipeline module mixes validation + compilation + IO

`app/analysis-codegen/lib/pipeline.ts` does three things:
1. Calls validate.ts validation
2. Calls compileAnalysis()
3. Writes files to disk

This is appropriate for a composition root helper, but the function `generateAnalysis` returns `boolean` (success/failure) by logging to console and checking diagnostic levels inline. A cleaner interface would return a result type.

### 6.4 `app/user-api/` is hardwired to TS AST + kind-checking

Every file in `app/user-api/` imports directly from `specs/ts-ast/` and `generated/ts-ast/kind-checking/`. This is correct — it's the composition root for the "kindscript" npm package. But it means adding a second grammar target or analysis would require either:
- Separate npm packages (one user-api per grammar+analysis combo)
- A parameterized user-api that accepts grammar/analysis at initialization

This is not a problem today but is a structural constraint worth documenting.

### 6.5 Mock spec has no frontend, no frontend directory needed

The mock grammar creates nodes directly via `createNode()` in tests. There's no TS AST → mock AST conversion. The empty `specs/mock/frontend/` directory is misleading — it suggests a frontend exists or should exist.

---

## 7. Summary of Recommendations

### Cleanup (low effort, no behavior change) — ALL DONE

| # | Action | Status |
|---|--------|--------|
| 1 | Delete `extractors.ts` and its test | Done |
| 2 | Delete empty `app/grammar-codegen/` directory | Done |
| 3 | Delete empty `specs/mock/frontend/` directory | Done |
| 4 | Remove `GeneratedFile` from grammar/derive.ts and grammar/index.ts | Done |
| 5 | Remove "Functor 2" / "Cross-Functor" naming from comments and logs | Done |
| 6 | Fix `AnalysisDepth` duplication — import from helpers.ts in convert.ts | Done |

Verified: 0 type errors, 317/317 tests passing after all changes.

### Boundary clarification (low-medium effort)

| # | Action | Files |
|---|--------|-------|
| 7 | Update CLAUDE.md to accurately describe analysis→grammar dependency | `CLAUDE.md` |
| 8 | Rename compile.ts internal `validateSpec` → `validateSpecForCodegen` | `analysis/compile.ts` |

### Optional consolidation (medium effort)

| # | Action | Files |
|---|--------|-------|
| 9 | Merge validate.ts into compile.ts as a pre-compilation check | `analysis/validate.ts` → `analysis/compile.ts`, `analysis/index.ts`, `app/analysis-codegen/lib/pipeline.ts`, tests |
| 10 | Extract ConvertContextBase in helpers.ts, extend in convert.ts | `specs/ts-ast/frontend/helpers.ts`, `specs/ts-ast/frontend/convert.ts` |

---

## 8. What's Working Well

The architecture has several strong properties that should be preserved:

1. **Clean composition roots**: `app/` directories have zero cross-imports. Each is an independent entry point.
2. **Spec-level barrels**: `specs/<target>/grammar/index.ts` cleanly encapsulates all grammar metadata computation. Adding a new grammar is straightforward.
3. **Generic analysis machinery**: `analysis/compile.ts` has zero knowledge of TS AST or kind-checking. Any AnalysisSpec produces a working evaluator.
4. **Function refs for equations**: Using actual Function values (not strings) for AttrDecl equations means compile.ts can auto-generate imports from fn.name, and deps are co-located via withDeps().
5. **Schema-driven converter**: `convert.ts` reads NODES at runtime to auto-register converters, with custom extractors only where TS stores data differently than the schema.
6. **Stateless ConvertContext**: Per-invocation context object makes buildKSTree reentrant and testable.
7. **createGrammarMetadata() factory**: Single function encapsulates the full grammar initialization sequence, making it testable and re-invocable.
