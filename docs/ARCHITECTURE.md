# KindScript Architecture

## System Overview

KindScript is a declarative attribute grammar system for architectural analysis of
TypeScript codebases.

At a high level:

```text
TypeScript source
  -> TypeScript AST
  -> KindScript mirror tree
  -> attribute evaluation
  -> root attributes and diagnostics
```

The important architectural split is between generic engines and concrete plugins.

## Package Topology

```text
libs/
  grammar/             Generic grammar engine
  behavior/            Generic behavior planning and adapter emission
  evaluation/          Generic evaluator runtime
  ag-ports/            Shared runtime contracts
  languages/*          Concrete language adapters
  analyses/*           Concrete analysis adapters

apps/
  cli/                 Composition roots and command shell
packages/
  ksc/                 Public source-backed package surface
```

## Bounded Contexts

### `libs/grammar`

Owns generic AST and grammar concerns.

- grammar contracts
- field metadata computation
- tree traversal and creation
- serialization
- parse-only pipeline

This package no longer owns concrete TS or mock adapters.

### `libs/behavior`

Owns generic analysis planning and adapter emission.

- validation
- dependency graph construction
- pivoting of analysis declarations
- `BehaviorPlan` creation
- generation of dispatch adapters and type maps

The current two-step model is:

```text
planBehavior(grammar, decl) -> BehaviorPlan
emitAdapters(plan, imports) -> generated source files
```

### `libs/evaluation`

Owns generic runtime evaluation.

- evaluator engine
- tree construction
- typed root-attribute access

Concrete product APIs sit above this package. The evaluator only knows about
grammar + dispatch + root.

### `libs/ag-ports`

Owns neutral runtime contracts used across packages.

This keeps evaluation-facing contracts out of concrete analysis packages and avoids
coupling behavior directly to evaluation internals.

### `libs/languages/*`

Own concrete source-language implementations.

Current packages:

- `@ksc/language-ts-ast`
- `@ksc/language-mock`

These packages contain grammar barrels and, where needed, translators and extraction.

### `libs/analyses/*`

Own concrete analyses.

Current packages:

- `@ksc/analysis-ts-kind-checking`
- `@ksc/analysis-eslint-equiv`
- `@ksc/analysis-mock`

Each analysis package owns:

- `spec.ts`
- `runtime.ts`
- `types.ts` when needed
- `generated/` adapter output

## Composition

The CLI is the composition root.

### Codegen path

`apps/cli/wiring/codegen/targets.ts` pairs:

- a concrete language grammar
- a concrete analysis declaration
- an output folder inside the analysis package

The behavior engine then emits generated adapters into:

```text
libs/analyses/<name>/src/generated/
```

### Evaluation path

`packages/ksc/internal/ts-kind-checking/*` explicitly wires:

- grammar from a language package
- translator from that language package
- generated dispatch from that analysis package
- dependency graph from that analysis package

`apps/cli` remains a thin shell over that reusable package-owned API.

## Design Principles

### Generic core, concrete edges

Concrete TypeScript and analysis code belongs in `libs/languages/*` and
`libs/analyses/*`, not in the generic engines.

### Generated adapters are owned by the analysis

Generated dispatch code is not global infrastructure. It is part of the concrete
analysis package that owns the spec and runtime.

### Explicit composition

The application layer decides which concrete language and analysis packages to wire
together. The evaluator does not discover adapters implicitly.

### Analysis-to-grammar coupling is explicit

Analyses are intentionally coupled to one grammar. Concrete analysis types may use
concrete node types from the language package they target.

## Public Entry Points

- `packages/ksc` owns the public `ksc` and `ksc/ts-kind-checking` entry points
- `ksc` exposes lightweight source/config helpers
- `ksc/ts-kind-checking` exposes the source-backed kind-checking API
- `@ksc/language-*` packages expose concrete language adapters
- `@ksc/analysis-*` packages expose concrete analyses

## Implementation Notes

- `libs/grammar`, `libs/behavior`, and `libs/evaluation` still follow a clean
  architecture-style split between `domain/` and `application/`
- the repo also uses package-level plugin boundaries for `libs/languages/*` and
  `libs/analyses/*`
- generated files are committed where needed so consumers do not need a codegen step

See `AGENTS.md` for the current developer guide and package-level conventions.
