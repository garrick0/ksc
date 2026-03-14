# ADR-003: Typed projection functions via TypedAGNode

Superseded by the current root-attribute runtime model. Projections were removed
as a runtime concept, so this ADR remains only as historical context for a
previous design.

**Status:** ACCEPTED

## Context

`AnalysisProjections<P>.projections` were typed `(root: Ctx) => P[Key]`. The `Ctx` interface's `attr()` method returns `any`, so projection functions had no type checking on attribute access. `root.attr('kindDefs')` returned `any` despite `KSCAttrMap` knowing the return type is `KindDefinition[]`.

The `TypedAGNode<M>` type already existed and was used in tests for type-safe attribute access. Extending it to projections closes the type safety gap at the final extraction step.

## Decision

Change `AnalysisProjections` to accept a type parameter `M` for the attr map, and have projection functions receive `TypedAGNode<M>` instead of `Ctx`:

```typescript
export interface AnalysisProjections<
  M = Record<string, unknown>,
  P extends Record<string, unknown> = Record<string, unknown>
> {
  projections: { [Key in keyof P]: (root: TypedAGNode<M>) => P[Key] };
  setup?: () => void;
}
```

The `M` parameter is propagated through `EvaluationTarget<K, M, P>` and `EvaluatorConfig<K, M, P>`.

## Consequences

- `AnalysisProjections<M, P>` gains the `M` parameter (M first, P second)
- `EvaluationTarget` already has `M` — it now flows through to `projections`
- `EvaluatorConfig` gains `M` to match
- The engine's projection invocation casts the tree to `TypedAGNode<M>`
- Adapter projections use `TypedAGNode<KSCAttrMap>` for type-safe `attr()` calls
- Mock projections that ignore the root parameter are unaffected
