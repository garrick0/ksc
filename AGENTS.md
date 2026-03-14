# KindScript — Developer Guide

## Architecture Overview

KindScript is a declarative attribute grammar system organized into bounded contexts
and concrete plugin packages.

The current architecture separates:

- generic engines in `libs/grammar`, `libs/behavior`, and `libs/evaluation`
- shared runtime contracts in `libs/ag-ports`
- concrete source-language implementations in `libs/languages/*`
- concrete analyses in `libs/analyses/*`
- public package entry points in `packages/ksc`
- composition roots in `apps/cli/wiring/*`

The goal is to keep the engines reusable and keep concrete TypeScript- or
analysis-specific code at the edges.

## Current Package Layout

```text
libs/
  ag-ports/            Shared runtime ports used across behavior/evaluation/analyses
  grammar/             Generic grammar engine and tree utilities
  behavior/            Generic behavior planning and adapter emission
  evaluation/          Generic evaluator runtime
  languages/
    ts-ast/            Concrete TypeScript grammar, translator, extraction
    mock/              Concrete mock grammar for tests
  analyses/
    ts-kind-checking/  Concrete TS kind-checking analysis
    eslint-equiv/      Concrete ESLint-equivalent analysis
    mock/              Concrete mock analysis
  kinds/               Shared domain package
  types/               Shared domain package
  user-config/         Shared config package

apps/
  cli/                 Runnable shell and composition roots

packages/
  ksc/                 Public source-backed `ksc` package
```

## Responsibilities

### `libs/grammar`

Generic grammar machinery only.

- grammar and AST port contracts
- metadata derivation
- tree creation and traversal
- serialization
- parse-only pipeline

`libs/grammar` does not own any concrete TS or mock adapters anymore.

### `libs/languages/*`

Concrete language implementations.

- grammar barrels such as `@ksc/language-ts-ast/grammar`
- source AST translators such as `@ksc/language-ts-ast/translator`
- extraction helpers such as `@ksc/language-ts-ast/extraction`

Today:

- `libs/languages/ts-ast` contains the TypeScript grammar, translator, and extraction
- `libs/languages/mock` contains the mock grammar used in tests

### `libs/behavior`

Generic behavior engine.

- `planBehavior(grammar, decl)` produces an in-memory `BehaviorPlan`
- `emitAdapters(plan, imports)` produces generated adapter source
- `compileAnalysis()` remains as the compatibility wrapper around plan + emit
- validation, pivoting, and dependency analysis live here

`libs/behavior` does not own concrete analyses.

### `libs/analyses/*`

Concrete analyses.

Each analysis package is a self-contained plugin that provides:

- `spec.ts` for `AnalysisDecl`
- `types.ts` for analysis-specific domain types where needed
- `runtime.ts` for analysis-owned runtime artifacts
- `generated/` for emitted dispatch adapters
- `index.ts` as the package barrel

Today:

- `libs/analyses/ts-kind-checking`
- `libs/analyses/eslint-equiv`
- `libs/analyses/mock`

### `libs/evaluation`

Generic evaluator runtime only.

- AG evaluator
- tree construction
- typed root attribute access

`libs/evaluation` should stay generic. Concrete program/project use cases live in
`packages/ksc`, not in `libs/evaluation`.

### `packages/ksc`

Public source-backed package surface.

- `ksc` exports lightweight config helpers
- `ksc/ts-kind-checking` exports the prewired TS kind-checking API
- browser builds resolve a worker-safe conditional entry for `ksc/ts-kind-checking`

### `libs/ag-ports`

Shared runtime contracts used where behavior-, evaluation-, and analysis-facing
types need a neutral home.

This package is the boundary package for types such as:

- `DispatchConfig`
- `AnalysisRuntime`
- `TypedAGNode`
- `Ctx`

### `apps/cli`

Thin runnable shell.

- `apps/cli/commands/*` contains pure command handlers
- `apps/cli/wiring/grammar/*` composes concrete language packages
- `apps/cli/wiring/codegen/targets.ts` defines codegen targets

## Ports and Implementations

```text
PORTS
├── Grammar<K>                  libs/grammar/application/ports/Grammar.ts
├── AstTranslatorPort<I, R, O>  libs/grammar/application/ports/AstTranslatorPort.ts
├── AnalysisDecl<K>             libs/behavior/application/ports/AnalysisDecl.ts
├── CodegenTarget<K>            libs/behavior/application/ports/CodegenTarget.ts
├── BehaviorPlan                libs/behavior/domain/plan.ts
├── DispatchConfig              libs/ag-ports/src/DispatchConfig.ts
├── AnalysisRuntime             libs/ag-ports/src/AnalysisRuntime.ts
├── TypedAGNode<M>              libs/ag-ports/src/TypedAGNode.ts
└── Ctx / KindCtx<N>            libs/ag-ports/src/Ctx.ts

CONCRETE PACKAGES
├── @ksc/language-ts-ast        Grammar + translator + extraction for TypeScript
├── @ksc/language-mock          Grammar for test fixtures
├── @ksc/analysis-ts-kind-checking
├── @ksc/analysis-eslint-equiv
└── @ksc/analysis-mock
```

## Runtime and Codegen Flow

### Codegen

```text
apps/cli/wiring/codegen/targets.ts
  -> language package provides Grammar<K>
  -> analysis package provides AnalysisDecl<K>
  -> libs/behavior plans behavior
  -> libs/behavior emits generated adapters
  -> generated files are written to libs/analyses/<name>/src/generated/
```

### Evaluation

```text
packages/ksc/internal/ts-kind-checking/*
  -> language package provides Grammar<K> and translator
  -> analysis package provides runtime + generated dispatch + dep graph
  -> libs/evaluation evaluates the AST
  -> callers read canonical root attributes
```

## Directory Guide

### `libs/grammar`

```text
domain/
  base-types.ts
  dep-graph-types.ts
  ports.ts
  schema-shapes.ts

application/
  metadata.ts
  parse-only.ts
  ports/
  serialize-tree.ts
  tree-ops.ts
```

### `libs/languages/ts-ast`

```text
src/
  grammar/
    index.ts
    nodes.ts
  translator/
    convert.ts
    helpers.ts
    custom-extractors.ts
  extraction/
    extract.ts
    index.ts
    types.ts
```

### `libs/behavior`

```text
application/
  compile.ts
  build-dispatch.ts
  equation-utils.ts
  pivot.ts
  validate.ts
  planning/plan.ts
  emission/emit.ts
  run-codegen.ts
  run-all-codegen.ts
  ports/

domain/
  plan.ts
  ports.ts
  types.ts
```

### `libs/analyses/ts-kind-checking`

```text
src/
  spec.ts
  types.ts
  runtime.ts
  generated/
    dispatch.ts
    attr-types.ts
    dep-graph.ts
```

Other analysis packages follow the same pattern.

### `libs/evaluation`

```text
domain/
  ctx.ts
  engine.ts
  evaluator-index.ts
  ports.ts
```

### `apps/cli`

```text
commands/
  check.ts
  codegen.ts
  init.ts

harness/
  args.ts
  dispatch.ts
  errors.ts
  format.ts

wiring/
  grammar/
    ts-ast.ts
    mock.ts
  evaluation/
    ts-kind-checking.ts
    eslint-equiv.ts
    mock.ts
  codegen/
    targets.ts
```

## Adding a New Language

1. Create `libs/languages/<name>/package.json`.
2. Add `src/grammar/index.ts` implementing `Grammar<K>`.
3. Add translator and extraction modules if that language needs them.
4. Add TS path aliases and package dependencies where used.
5. Wire the new language in `apps/cli/wiring/grammar/` if the CLI should use it.

## Adding a New Analysis

1. Create `libs/analyses/<name>/package.json`.
2. Add `src/spec.ts` with `analysisDecl`.
3. Add `src/types.ts` if the analysis needs domain-specific types.
4. Add `src/runtime.ts`.
5. Add a codegen target in `apps/cli/wiring/codegen/targets.ts`.
6. Run `pnpm codegen` from the `ksc` repo root to populate `src/generated/`.
7. Add package-owned runtime/public wiring under `packages/ksc` if it should be runnable.

## Architectural Rules

- Keep generic engine code in `libs/grammar`, `libs/behavior`, and `libs/evaluation`.
- Keep concrete source-language code in `libs/languages/*`.
- Keep concrete analysis code in `libs/analyses/*`.
- Generated dispatch adapters live inside the owning analysis package.
- Command handlers remain pure; wiring belongs in `apps/cli/wiring/*`.
- Do not reintroduce concrete adapters into `libs/grammar` or `libs/evaluation`.

## Documentation Management

The committed doc set is fixed:

- `README.md`
- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/BACKLOG.md`
- `docs/adr/*`
- `libs/grammar/README.md`
- `libs/behavior/README.md`
- `libs/evaluation/README.md`
- `apps/cli/README.md`

Working notes, research, and plans belong in `.working/`.
