# Schema-First Node Definitions — Implementation Plan

> **Superseded:** The `libs/ag-schema` library described in this plan was
> subsequently eliminated entirely. The codegen now generates all runtime
> structures as pure static code in `ast-schema/generated/schema.ts`, with no
> runtime library dependencies. See
> [`eliminate-ag-schema-plan.md`](eliminate-ag-schema-plan.md) for details.
> This document is retained as historical context for the original design.

## Goal

Replace the current dual-maintenance AST architecture (hand-written TypeScript
interfaces in `ast.ts` + hand-written converters in `convert.ts`) with a single
`defineNode()` source of truth that provides:

1. **Runtime schema** — introspectable node structure (kinds, children, props)
2. **TypeScript types** — inferred from the schema definitions
3. **Derived `getChildren`** — automatic from named children declarations
4. **Completeness checking** — validate production equations cover all node kinds
5. **Simplified converters** — schema-driven child extraction

## Current State

- `ast.ts`: 2252 lines, 360 interfaces, ~77 hand-written + ~280 generated
- `convert.ts`: 2548 lines, 358 `register()` calls
- `getChildren()`: 5 lines, manually written
- No runtime schema — structure knowledge exists only at the type level

## Architecture

```
libs/ag-schema/src/
  define.ts       — defineNode(), child(), optChild(), list(), prop(), defineLeaf()
  schema.ts       — NodeSchema registry, deriveGetChildren(), completeness checking
  index.ts        — public exports

src/pipeline/
  node-defs.ts    — all 360 defineNode() calls (THE source of truth)
  ast.ts          — re-exports types from node-defs.ts (backward compat)
  convert.ts      — updated to use schema-driven conversion
```

## Phases

### Phase 1: Schema Library (`libs/ag-schema/`)
- [x] `define.ts` — builder functions with phantom types for type inference
- [x] `schema.ts` — registry, getChildren derivation, completeness checking
- [x] `index.ts` — exports
- [x] Basic test

### Phase 2: Migration Script
- [x] `scripts/gen-node-defs.ts` — parses existing ast.ts, generates defineNode() calls
- [x] Run script, produce `src/pipeline/node-defs.ts` (2147 lines, 360 definitions)
- [x] Verify generated types match existing interfaces (tsc --noEmit passes)

### Phase 3: Wire Up
- [x] Replace manual `getChildren` with schema-derived version in `program.ts`
- [x] Replace manual `getChildren` with schema-derived version in `serialize.ts`
- [x] Remove unused `getChildren` import from `convert.ts`
- [ ] Update `program.ts` to use schema for completeness checking (future)

### Phase 4: Verify
- [x] All existing tests pass (107/107)
- [x] Schema introspection works (kinds list, children map, child fields)
- [x] Completeness checking works
- [x] getChildren equivalence test — schema-derived matches manual for all nodes in real tree

### Phase 5: Clean Up
- [x] Migrate all getChildren imports to node-defs.ts
- [x] Update architecture docs

## Type System Design

```typescript
// Builder functions (runtime value + phantom type)
child<T>()    → ChildSpec<T>       // required single child
optChild<T>() → OptChildSpec<T>    // optional single child
list<T>()     → ListSpec<T>        // array of children
prop<T>()     → PropSpec<T>        // non-child property

// Type inference
type InferNode<D> = D extends NodeDef<infer K, infer S> ?
  { kind: K; pos: number; end: number; text: string; children: KSNode[] }
  & InferFields<S>
  : never;
```

## Progress Log

### [DONE] Phase 1 — Schema Library
- Created `libs/ag-schema/src/define.ts` — defineNode, defineLeaf, child, optChild, list, prop
- Created `libs/ag-schema/src/schema.ts` — createNodeSchema, getChildren derivation, completeness checking
- Created `libs/ag-schema/src/index.ts` — public exports
- Phantom types carry specific child types (e.g., `child<KSIdentifier>()`) for type inference

### [DONE] Phase 2 — Migration Script
- Created `scripts/gen-node-defs.ts` — regex-based parser for ast.ts interfaces
- Parses all 360 interfaces, classifies each field:
  - `KSNode` → `child()`, `KSSpecific` → `child<KSSpecific>()`
  - `KSNode | undefined` → `optChild()`, `KSSpecific | undefined` → `optChild<KSSpecific>()`
  - `KSNode[]` → `list()`, `KSSpecific[]` → `list<KSSpecific>()`
  - `string`, `boolean`, `number`, `readonly number[]` → `prop<T>()`
- Generated `src/pipeline/node-defs.ts` (2147 lines): 156 complex + 204 leaf definitions
- All types check clean (`tsc --noEmit` passes)

### [DONE] Phase 3 — Wire Up
- `program.ts` now imports `getChildren` from `node-defs.ts` (schema-derived)
- `serialize.ts` now imports `getChildren` from `node-defs.ts`
- Removed unused `getChildren` import from `convert.ts`
- The entire pipeline now uses schema-derived tree traversal

### [DONE] Phase 4 — Verify
- 107/107 tests pass (98 existing + 9 new schema tests)
- Schema introspection works: `ksNodeSchema.kinds` (360), `getChildFields()`, `getDef()`
- Completeness checking works: `checkCompleteness()` validates equation coverage
- getChildren equivalence verified: schema-derived matches manual for every node in a real AST
- New test file: `test/node-schema.test.ts`

### [DONE] Phase 5 — Clean Up
- Migrated all `getChildren` imports from `ast.ts` to `node-defs.ts`:
  - `src/program.ts`, `src/pipeline/serialize.ts`
  - `test/binder.test.ts`, `test/checker.test.ts`, `test/convert.test.ts`, `test/grammar.test.ts`
- Removed unused `getChildren` import from `convert.ts`
- Old `ast.ts` `getChildren` function retained for now (used by comparison test)
- 107/107 tests pass with schema-derived getChildren powering the entire pipeline

## Summary

**Implementation complete.** The schema-first architecture is fully wired in:

```
libs/ag-schema/src/          — Generic schema library (154 + 126 + 35 = 315 lines)
  define.ts                  — defineNode, defineLeaf, child, optChild, list, prop
  schema.ts                  — createNodeSchema, derived getChildren, completeness checking
  index.ts                   — public exports

scripts/gen-node-defs.ts     — Migration script (ast.ts → defineNode() calls)

src/pipeline/node-defs.ts    — 360 defineNode()/defineLeaf() calls + schema + getChildren
test/node-schema.test.ts     — 9 tests verifying schema correctness
```

Key wins:
1. **Runtime schema** — `ksNodeSchema.kinds` (360), `getChildFields()`, `getDef()`, `checkCompleteness()`
2. **Derived getChildren** — automatically collects named children in declaration order
3. **Single source of truth** — `defineNode()` calls define both structure AND types
4. **Verified equivalent** — schema getChildren produces identical results to manual version
