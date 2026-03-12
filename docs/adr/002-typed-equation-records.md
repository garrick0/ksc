# ADR-002: Type-safe equation records with EquationFn

**Status:** ACCEPTED

## Context

`AttrDecl<K>.equations` was typed `Partial<Record<K, Function>>`. The `Function` type erases equation signatures: you can assign a function with wrong parameters or return type, and TypeScript won't complain. The error only surfaces at runtime or in generated dispatch code.

The compile pipeline only reads `fn.name` from equation functions at runtime, but the declaration site is where authors work. Typing equations at declaration prevents a class of bugs where wrong `ctx` type, wrong return type, or wrong parameter arity pass silently.

## Decision

Replace `Function` with `EquationFn<T>` — a typed equation callback:

```typescript
export type EquationFn<T = unknown> =
  ((ctx: any, ...args: any[]) => T) & { deps?: string[] };

export type EquationMap<K extends string, T = unknown> =
  Partial<Record<K, EquationFn<T>>>;
```

The `ctx` parameter uses `any` because the compile pipeline only reads `fn.name` — type safety for ctx narrowing is enforced at the equation declaration site (where the author writes `KindCtx<KSIdentifier>`), not at the `AttrDecl` assignment site.

`SynAttr.equations` and `InhAttr.parentEquations` use `EquationMap<K>` instead of `Partial<Record<K, Function>>`.

## Consequences

- `withDeps()` return type aligns with `EquationFn` (no separate internal interface)
- All existing equation functions already conform to the required signatures — migration is type-only
- The compile pipeline reads `fn.name` at runtime (unaffected by type changes)
- `pivot.ts` uses `EquationFn` instead of `Function` in its record types
