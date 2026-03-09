# Option C Implementation Plan: Spec-Owned Analysis Code Generation

## Status: COMPLETE

## Goal

Move all analysis-pattern-specific code generation out of `analysis/compile.ts` and into the spec. After this change:
- `analysis/compile.ts` is a **generic AG evaluator generator** — no knowledge of kind-checking patterns
- `analysis/` has **zero imports** from `generated/` or `specs/`
- Specs own **all pattern-specific logic**: attribute derivation, method body templates, grammar config
- `compile.ts` handles only generic AG concerns: dep graph, cache, class skeleton, tree builder

## Design

### `AttrDecl`

```typescript
interface AttrDecl {
  name: string;
  direction: AttrDirection;
  type: string;
  deps: string[];
  spec: 'binder' | 'checker';
  equations?: EquationSet;               // compile.ts generates structural body
  generateBody?: (cache: string) => string[];  // spec provides method body lines
}
```

- If `equations` is provided → compile.ts generates the structural body (syn/inh/collection dispatch)
- If `generateBody` is provided → compile.ts wraps those lines with cache check + cycle detection
- The two are mutually exclusive

### `AnalysisSpec`

```typescript
interface AnalysisSpec {
  attrs: AttrDecl[];
  projections: {
    binder: (root: Ctx) => KindDefinition[];
    checker: (root: Ctx) => CheckerDiagnostic[];
  };
  grammarConfig: {
    rootKind: string;       // e.g., 'CompilationUnit'
    fileNameField: string;  // e.g., 'fileName'
  };
  evaluatorSetup?: {
    imports: (paths: ImportPaths) => string[];
    moduleSetup: string[];
    helperMethods: string[];
  };
  violationRules?: Record<string, ViolationRule[]>;  // for runtime + validation
}
```

### What moved where

| Before | What | After |
|---|---|---|
| `analysis/compile.ts` → `deriveAllAttrs()` | Property→context→violation derivation | Spec builds full 22-attr list |
| `analysis/compile.ts` → `generateContextBody()` | Context body template | Spec's `contextBody()` helper → `generateBody` closures |
| `analysis/compile.ts` → `generateViolationBody()` | Violation body template | Spec's `violationBody()` helper → `generateBody` closures |
| `analysis/compile.ts` → `generateAllViolationsBody()` | AllViolations body template | Spec's `allViolationsAttr.generateBody` closure |
| `analysis/compile.ts` → `addStructuralImports()` | Binder import generation | Spec's `evaluatorSetup.imports` |
| `analysis/compile.ts` → `_findFileName()` hardcoding | `'CompilationUnit'` + `'fileName'` | Spec's `grammarConfig` |
| `analysis/compile.ts` → module-level setup | Rule extraction, equation extraction | Spec's `evaluatorSetup.moduleSetup` |
| `analysis/violation.ts` | KindToNode import from generated/ | `specs/ts-ast/kind-checking/violation.ts` |

### What stays in compile.ts (generic AG)

- `buildDepGraphFromAttrs()` — topological sort
- `generateAttrTypes()` — KSCAttrMap interface
- `generateEvaluator()` — class skeleton, navigation, cache fields, attr() dispatch
- `generateStructuralBody()` — syn/inh/collection from EquationSet
- `generateMethod()` — cache check + cycle detection wrapper + dispatch to equations or generateBody
- `buildKSCTree` generation — schema-aware tree builder
- `evaluate()` + `buildTree()` — entry points

## Phases

### Phase 1: Update types ✅
- `analysis/types.ts` — added `AttrDecl`, `GrammarConfig`, `EvaluatorSetup`, `ImportPaths`; updated `AnalysisSpec` to use `attrs` + `grammarConfig` + `evaluatorSetup` + `violationRules`; removed `PropertyDecl` and `StructuralAttr`

### Phase 2: Move violation.ts ✅
- Created `specs/ts-ast/kind-checking/violation.ts` (grammar-specific, imports KindToNode)
- Deleted `analysis/violation.ts`
- Updated `analysis/index.ts` — removed violation re-export

### Phase 3: Rewrite compile.ts ✅
- Removed `DerivedAttr`, `AttrCategory`, `deriveAllAttrs()`
- Removed `generateContextBody()`, `generateViolationBody()`, `generateAllViolationsBody()`
- Removed `addStructuralImports()`
- `generateEvaluator()` → uses `spec.evaluatorSetup` for imports/moduleSetup/helperMethods
- `_findFileName()` → uses `spec.grammarConfig.rootKind` + `fileNameField`
- `generateMethod()` → dispatches to `a.generateBody(cache)` or `generateStructuralBody()`
- `compileAnalysis()` → reads `spec.attrs` directly, no derivation
- File reduced from ~739 lines to ~516 lines

### Phase 4: Rewrite specs ✅
- `specs/ts-ast/kind-checking/spec.ts` — builds full 22-attr list with `contextBody()`, `violationBody()`, and `allViolationsAttr` helpers; provides `evaluatorSetup` (imports, moduleSetup) and `grammarConfig`; exports `violationRules` record
- `specs/mock/mock-analysis/spec.ts` — updated to new `AnalysisSpec` interface (1 attr, minimal evaluatorSetup + grammarConfig)

### Phase 5: Composition roots ✅
- No changes needed — roots just pass through `AnalysisSpec` and `GrammarSpec`

### Phase 6: Update validate.ts ✅
- Now checks `spec.violationRules` trigger kinds and `spec.attrs[].equations.cases` keys

### Phase 7: Update tests ✅
- `test/compile-analysis.test.ts` — rewritten for new interface (explicit attrs, no auto-derivation)
- `test/violation-builder.test.ts` — updated import path to `specs/ts-ast/kind-checking/violation.js`
- `test/validate.test.ts` — rewritten for new interface (attrs + violationRules)
- `test/codegen-mock.test.ts` — updated expectation (mock has 1 attr, not 2)

### Phase 8: Regenerate + validate ✅
- `npx tsx app/codegen/ts-kind-checking.ts` — generates 22 attrs, all validation passes
- `npx tsx app/codegen/mock.ts` — generates 1 attr, all validation passes
- `npx tsc --noEmit` — clean
- `npx vitest run` — 295 tests pass across 23 files

## Files changed

### Modified
- `analysis/types.ts` — new interfaces, removed PropertyDecl/StructuralAttr
- `analysis/compile.ts` — fully generic, no pattern-specific code
- `analysis/validate.ts` — uses `spec.attrs` + `spec.violationRules`
- `analysis/index.ts` — updated exports
- `specs/ts-ast/kind-checking/spec.ts` — full 22-attr list with generateBody closures
- `specs/mock/mock-analysis/spec.ts` — new AnalysisSpec interface
- `test/compile-analysis.test.ts` — rewritten
- `test/validate.test.ts` — rewritten
- `test/violation-builder.test.ts` — updated import
- `test/codegen-mock.test.ts` — updated expectation
- `generated/ts-ast/kind-checking/evaluator.ts` — regenerated (899 lines)
- `generated/ts-ast/kind-checking/attr-types.ts` — regenerated

### Created
- `specs/ts-ast/kind-checking/violation.ts` — type-safe violation builder (moved from analysis/)

### Deleted
- `analysis/violation.ts` — moved to spec directory
