# Evaluation Bounded Context

`libs/evaluation` is the generic attribute grammar evaluator runtime.

It should stay independent from concrete language and analysis authoring code.

## Responsibilities

- execute generated dispatch with caching and cycle detection
- build decorated AG trees
- expose type-safe root attribute access

## Structure

```text
domain/
  ctx.ts
  engine.ts
  evaluator-index.ts
  ports.ts
```

## What It Depends On

At composition time, evaluation consumes:

- grammars from `libs/languages/*`
- generated dispatch from `libs/analyses/*`
- shared contracts from `libs/ag-ports`

The evaluator itself remains generic.

## Key Types

### `EvaluateArgs<K>`

Contains:

- `grammar`
- `dispatch`
- `root`
- optional `setup`

### `TypedAGNode<M>`

Provides:

- typed `attr(...)` access
- structural queries over the decorated tree

## Composition

Concrete product APIs sit above this package. `packages/ksc` owns the reusable TS
kind-checking runtime and `apps/cli` remains a thin shell over that API.

## Design Rule

Do not reintroduce concrete product use cases, projections, or target singletons
under `libs/evaluation`. This package stays runtime-only.
