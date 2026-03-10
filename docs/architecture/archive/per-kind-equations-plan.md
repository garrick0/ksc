# Per-Kind Equations with Parameterized Attributes

## Goal

Replace `render: RenderFn` with declarative, direction-typed fields. Add parameterized attribute support to collapse 16 repetitive attrs into 2. Reduce from 22 attrs to 8.

## Current → New Attr Count

| Current (22 attrs) | New (8 attrs) |
|---|---|
| kindDefs (syn) | kindDefs (syn) |
| defEnv (inh) | defEnv (inh) |
| defLookup (syn) | defLookup (syn) |
| kindAnnotations (syn) | kindAnnotations (syn) |
| 8× `*Context` (inh) | contextFor(property) (inh, parameterized) |
| 8× `*Violation` (syn) | violationFor(property) (syn, parameterized) |
| allViolations (collection) | allViolations (syn) |
| nodeCount (collection) | nodeCount (collection) |

## New AttrDecl Interface

```typescript
interface ParamDef { name: string; type: string; }

interface AttrBase {
  name: string;
  type: string;
  deps: string[];
  parameter?: ParamDef;
}

interface SynAttr extends AttrBase {
  direction: 'syn';
  default: string;                         // expression for non-matching kinds
  equations?: Record<string, string>;      // per-kind expressions
}

interface InhAttr extends AttrBase {
  direction: 'inh';
  rootValue: string;                       // expression at root
  parentEquations?: Record<string, string>; // return T|undefined; undefined = copy-down
}

interface CollectionAttr extends AttrBase {
  direction: 'collection';
  init: string;                            // per-node contribution
  combine: string;                         // (acc, child) => combined
}

type AttrDecl = SynAttr | InhAttr | CollectionAttr;
```

## Parameterized Attribute Caching

Non-parameterized: single cache field `_c_name: T | undefined`
Parameterized: Map cache `_pc_name = new Map<ParamType, T>()`

## Files Changed

| Action | File | Notes |
|--------|------|-------|
| Modify | `analysis/types.ts` | New AttrDecl union, remove RenderFn |
| Modify | `analysis/ctx.ts` | Add `findFileName()`, varargs `attr()` |
| Modify | `analysis/compile.ts` | Direction-aware codegen, parameterized support |
| Modify | `analysis/index.ts` | Remove render.ts re-exports |
| Delete | `analysis/render.ts` | Combinators replaced by direction-aware codegen |
| Modify | `specs/ts-ast/kind-checking/equations.ts` | Add eq_contextOverride, eq_violationFor, eq_allViolations |
| Simplify | `specs/ts-ast/kind-checking/properties.ts` | Just PROPERTY_NAMES + RULES_BY_PROPERTY |
| Rewrite | `specs/ts-ast/kind-checking/spec.ts` | 8 attrs, no auto-derivation |
| Delete | `specs/ts-ast/kind-checking/templates.ts` | Custom RenderFn factories no longer needed |
| Modify | `specs/mock/mock-analysis/spec.ts` | Use CollectionAttr |
| Modify | `test/checker.test.ts` | noImportsContext() → contextFor('noImports') |
| Modify | `test/compile-analysis.test.ts` | New AttrDecl format |
| Modify | `test/validate.test.ts` | New AttrDecl format |

## Implementation Progress

- [x] Step 1: Update `analysis/types.ts`
- [x] Step 2: Update `analysis/ctx.ts`
- [x] Step 3: Update `analysis/compile.ts`
- [x] Step 4: Update `analysis/index.ts`
- [x] Step 5: Delete `analysis/render.ts`
- [x] Step 6: Update equation functions
- [x] Step 7: Simplify properties.ts
- [x] Step 8: Rewrite spec.ts (8 attrs)
- [x] Step 9: Delete templates.ts
- [x] Step 10: Update mock spec
- [x] Step 11: Update tests
- [x] Step 12: Regenerate + tsc + test
- [x] Step 13: Update CLAUDE.md + MEMORY.md
