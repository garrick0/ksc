# Behavior Bounded Context

`libs/behavior` is the generic behavior engine. It turns declarative analysis
specifications into generated adapter source.

Concrete analyses live in `libs/analyses/*`, not in this package.

## Responsibilities

- define `AnalysisDecl<K>` and codegen-facing contracts
- validate analysis specs against grammars
- compute dependency graphs
- plan behavior into an in-memory `BehaviorPlan`
- emit generated adapter files from a plan
- run the codegen pipeline

## Structure

```text
domain/
  plan.ts
  ports.ts
  types.ts

application/
  build-dispatch.ts
  compile.ts
  equation-utils.ts
  pivot.ts
  validate.ts
  planning/plan.ts
  emission/emit.ts
  run-codegen.ts
  run-all-codegen.ts
  ports/
```

## Key Model

The behavior pipeline is split into two stages:

```text
planBehavior(grammar, decl) -> BehaviorPlan
emitAdapters(plan, imports) -> generated source files
```

`compileAnalysis()` remains as the compatibility wrapper around those steps.

## Concrete Analyses

Concrete analyses now live in:

- `@ksc/analysis-ts-kind-checking`
- `@ksc/analysis-eslint-equiv`
- `@ksc/analysis-mock`

Each analysis package owns its `spec.ts`, runtime artifacts, and generated output.

## Output Location

Generated adapters are written into the owning analysis package:

```text
libs/analyses/<name>/src/generated/
```

## Design Rule

Do not add analysis-specific specs, equations, or generated output back into
`libs/behavior`. This package should stay generic.
