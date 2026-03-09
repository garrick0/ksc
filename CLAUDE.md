# KindScript — Developer Guide

## Architecture Overview

KindScript is a **two-functor compilation system** that generates a specialized
attribute grammar evaluator from declarative specifications.

- **Functor 1** (`grammar/compile.ts`): `compileGrammar(GrammarSpec) → CompiledGrammar` — generates 6 generic AST files + delegates convert.ts to spec
- **Functor 2** (`analysis/compile.ts`): `compileAnalysis(AnalysisSpec, opts?) → CompiledAnalyzer` — generates evaluator + attr-types
- **Spec validation** (`analysis/validate.ts`): validates attr dep consistency
- **Grammar verification** (`specs/ts-ast/grammar/verify.ts`): checks grammar coverage against TypeScript AST

## Directory Structure

```
specs/                            Pluggable data specifications (grammars + analyses)
  ts-ast/                         TypeScript AST target
    grammar/                      TS AST grammar (364 node kinds)
      nodes.ts                    Node kind declarations
      extractors.ts               Field extraction data (type-safe DSL expressions)
      spec.ts                     Grammar spec factory (takes builder, returns GrammarSpec)
      convert-generator.ts        Spec-owned convert.ts generator (uses shared skeleton + per-kind helpers)
      convert-helpers.ts          TS-specific extractor helpers (pure — ConvertContext passed in)
      verify.ts                   Grammar verification vs TypeScript AST (spec-owned, TS-specific)
    kind-checking/                Kind-checking analysis over TS AST
      types.ts                    Domain types (KindDefinition, Diagnostic, PropertySet, Kind<R>)
      equations.ts                All equation functions (per-kind equations for each attr)
      spec.ts                     AnalysisSpec (8 attrs: 4 structural + 2 parameterized + allViolations + nodeCount)
  mock/                           Mock target (testing)
    grammar/                      Mock grammar (5 node kinds)
      nodes.ts, spec.ts, convert-generator.ts
    mock-analysis/                Mock analysis (1 attr)
      spec.ts

grammar/                          Grammar machinery + compilation (fully generic, zero TS-specific code)
  builder.ts                      Scoped builder DSL (createGrammarBuilder, field helpers)
  compile.ts                      Functor 1: compileGrammar(GrammarSpec) → CompiledGrammar
  convert-codegen.ts              Shared per-kind converter generation + expression validation
  convert-skeleton.ts             Shared TS-frontend convert.ts infrastructure template
  extractor-dsl.ts                Type-safe expression builders for field extractors
  field-extractors.ts             Generic field extractor assembly
  export.ts                       Dashboard data extraction
  types.ts                        GrammarSpec, CompiledGrammar, ConvertGenerator, GeneratedFile

analysis/                         Analysis machinery + compilation (generic, no spec imports)
  types.ts                        Spec interfaces (AnalysisSpec, AttrDecl, etc.) + generic AG types
  ctx.ts                          Ctx interface (generic — node: unknown, attr: any)
  compile.ts                      Functor 2: compileAnalysis(AnalysisSpec) → CompiledAnalyzer (fully generic AG)
  validate.ts                     Spec validation (attr dep consistency)

app/                              Composition roots + shared lib
  index.ts                        Public API (npm package)
  cli.ts                          ksc CLI (check, init)
  codegen/                        Codegen composition roots (one per grammar+analysis)
    ts-kind-checking.ts           TS AST + kind-checking → generated/ts-ast/
    mock.ts                       Mock grammar + mock analysis → generated-mock/mock/
    lib/codegen.ts                Shared codegen helpers + CLI runner
  lib/                            Shared code used by entry points
    program.ts, config.ts, parse.ts, types.ts

generated/                        Machine-generated output (never edit)
  ts-ast/                         Output grouped by grammar target
    grammar/                      Functor 1 output (7 files: 6 generic + convert.ts from spec)
    kind-checking/                Functor 2 output (evaluator.ts, attr-types.ts)
```

## Composition Root Pattern

Each grammar+analysis combination has its own **composition root** in `app/codegen/`:

```
app/codegen/ts-kind-checking.ts   → generated/ts-ast/grammar/ + generated/ts-ast/kind-checking/
app/codegen/mock.ts               → generated-mock/mock/grammar/ + generated-mock/mock/mock-analysis/
```

Shared codegen logic lives in `app/codegen/lib/codegen.ts`. Each root:
1. Imports its grammar spec factory (e.g., `specs/ts-ast/grammar/spec.ts`)
2. Imports its analysis spec (e.g., `specs/ts-ast/kind-checking/spec.ts`)
3. Configures output directories and generated import paths
4. Optionally imports a verifier (e.g., `specs/ts-ast/grammar/verify.ts`)
5. Calls `runCodegenCLI(config)`

### Adding a new composition root

1. Create grammar data in `specs/<target>/grammar/` (nodes.ts, spec.ts)
2. Create analysis data in `specs/<target>/<analysis>/spec.ts`
3. Create `app/codegen/<name>.ts` — import data, configure `runCodegenCLI`
4. Set `generatedImports` (specImportPath, grammarImportPath, analysisImportPath) relative to the analysis output directory

## Specs vs Machinery Separation

Data specifications and shared machinery live in separate top-level directories:

- `specs/` — Declarative specifications + spec-local helpers (equation functions, property types, constants, convert generators, verification).
- `grammar/` — Grammar machinery (builder DSL, compilation, shared codegen helpers, field extractor assembly). Fully generic — zero TS-specific code.
- `analysis/` — Analysis machinery (compilation, validation). **Fully generic — no spec or grammar imports.** `Ctx` uses `node: unknown`, `AnalysisSpec` has no domain-specific fields. `AttrDecl` is a discriminated union (SynAttr | InhAttr | CollectionAttr) with function references (not strings) and optional parameterized attribute support. Dependencies are inferred from `withDeps()` metadata on equation functions.

### GrammarSpec interface

GrammarSpec is minimal — just the data that the 6 generic generators need:

```typescript
interface GrammarSpec {
  nodes: ReadonlyMap<string, NodeEntry>;
  sumTypes: ReadonlyMap<string, SumTypeEntry>;
  convertGenerator?: ConvertGenerator;  // () => string — spec closes over all convert-specific data
}
```

Convert-specific data (fieldExtractors, skipConvert, syntaxKindOverrides) is internal to the spec's convert generator closure — not on GrammarSpec.

### AnalysisSpec interface

AnalysisSpec is fully generic — four fields, no domain-specific concepts:

```typescript
interface AnalysisSpec {
  attrs: AttrDecl[];
  projections: Record<string, (root: Ctx) => unknown>;
  grammarConfig: GrammarConfig;
  evaluatorSetup?: EvaluatorSetup;
}
```

Specs own their evaluation entry point via `evaluatorSetup.evaluateBody` and non-equation imports via `evaluatorSetup.imports`. Equation imports are auto-generated by `compile.ts` from the Function references in AttrDecl fields (`fn.name` → import line). The equations path is derived as `specImportPath.replace('/spec.js', '/equations.js')`.

### Current specs

| Directory | What it is |
|---|---|
| `specs/ts-ast/grammar/` | TypeScript AST grammar (364 node kinds) |
| `specs/ts-ast/kind-checking/` | Kind-checking analysis over the TS grammar |
| `specs/mock/grammar/` | Mock grammar for testing (5 node kinds) |
| `specs/mock/mock-analysis/` | Mock analysis for testing (1 attr) |

### Adding a new spec

**New grammar** (e.g., Python AST):
1. Create `specs/python-ast/grammar/nodes.ts` using the builder DSL
2. Create `specs/python-ast/grammar/convert-generator.ts` — spec-owned convert.ts generator (uses shared helpers from `grammar/convert-codegen.ts` for per-kind converters, uses `grammar/convert-skeleton.ts` for TS-frontend infrastructure or provides its own)
3. Create `specs/python-ast/grammar/spec.ts` — spec factory using `createGrammarBuilder()`, sets `convertGenerator` as a closure over all convert-specific data
4. The `grammar/` machinery (builder, field-extractors, convert-codegen, convert-skeleton) is reused — zero changes needed

**New analysis** (e.g., complexity analysis over TS AST):
1. Create `specs/ts-ast/complexity/spec.ts` with an `AnalysisSpec` — provide full `attrs` list, `grammarConfig`, `evaluatorSetup`
2. Create `specs/ts-ast/complexity/types.ts` for analysis-specific vocabulary
3. Create `specs/ts-ast/complexity/equations.ts` — equation functions wrapped with `withDeps()`, standardized `(ctx)` or `(ctx, param)` signatures
4. Attrs use direction-typed declarations with function references (not strings) and optional parameters
5. The `analysis/` machinery (compile, validate) is reused — it's fully generic
6. The nesting under `ts-ast/` makes the grammar dependency structural

## Codegen Commands

```bash
npx tsx app/codegen/ts-kind-checking.ts              # all (grammar + validate + analysis)
npx tsx app/codegen/ts-kind-checking.ts grammar      # grammar only
npx tsx app/codegen/ts-kind-checking.ts analysis     # analysis only
npx tsx app/codegen/ts-kind-checking.ts verify       # grammar vs TypeScript AST
npm run codegen                                      # shorthand for all

npx tsx app/codegen/mock.ts                          # mock codegen (testing)
```

## Testing

```bash
npx vitest run                      # all tests
npx vitest run --testTimeout=30000  # with timeout for slow fixtures
npx vitest run test/checker.test.ts # single file
```

## Key Conventions

- AG attribute directions: `syn` (synthesized), `inh` (inherited), `collection`
- AttrDecl is a discriminated union: SynAttr (default + equations), InhAttr (rootValue + parentEquations), CollectionAttr (init + combine)
- AttrDecl fields use `AttrExpr` (Function | null | number | boolean | CodeLiteral) — not strings
- `withDeps(deps, fn)` attaches dep metadata to equation functions; `collectDepsForAttr(attr)` reads it
- `code(expr)` wraps raw code strings as CodeLiteral; equation functions are direct Function references
- Equation functions use standardized signatures: `(ctx: Ctx)` or `(ctx: Ctx, param: ParamType)`
- Parameterized attributes (JastAdd-style): optional `parameter: { name, type }` on any attr, generates Map-based caching
- Equations: syn equations are Function refs, inh parentEquations return `T | undefined` (undefined = copy-down)
- Grammar specs use builder DI — `buildGrammarSpec(createGrammarBuilder())` from `specs/<target>/grammar/spec.ts`
- Generated files have `AUTO-GENERATED` headers — never edit them manually
- `generated/` is committed (not gitignored) so consumers don't need codegen
- `generated-mock/` is gitignored (test artifact only)
- Domain types (`KindDefinition`, `Diagnostic`, `ViolationRule`) live in `specs/`, not `analysis/`
- Projection keys use domain names (`definitions`, `diagnostics`), not compiler-pass names
