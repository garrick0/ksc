# Plan: Eliminate libs/ag-schema — Option B (Codegen Everything, No Runtime Library)

**Status: COMPLETE** — All steps implemented, 148/148 tests passing.

## Context

libs/ag-schema provided three things at runtime:

1. `getChildren(node)` — the tree walker (used by program.ts, serialize.ts)
2. `ksNodeSchema.checkCompleteness(equations)` — equation coverage checker (test-only)
3. `ksNodeSchema.kinds` / `getChildFields()` / `getDef()` — introspection (test-only)

All of this was derived from 364 `NodeDef` objects allocated at startup from 1831 lines of
generated `defineNode()`/`defineLeaf()` calls, which existed only to feed `createNodeSchema()`.
The phantom-type field specs (`{ __tag: 'child' }`) served no runtime purpose — they were the
type-inference mechanism before codegen generated `node-types.ts` directly. Now they're vestigial.

serialize.ts and builders.ts already proved the pattern: they generate their own metadata tables
(the `F` table in serialize.ts, inline field access in builders.ts) and don't use ag-schema at all.

## What was done

Eliminated libs/ag-schema as a runtime library entirely. The codegen generates all runtime
structures as static code instead of going through the defineNode/createNodeSchema intermediary.

## What was deleted

| File | Lines | What it was |
|------|-------|-----------|
| `libs/ag-schema/src/define.ts` | 154 | defineNode, defineLeaf, phantom-type field specs |
| `libs/ag-schema/src/schema.ts` | 126 | createNodeSchema, NodeSchema interface |
| `libs/ag-schema/src/index.ts` | 35 | barrel re-exports |
| `ast-schema/generated/node-defs.ts` | 1831 | 364 defineNode/defineLeaf calls |
| `ast-schema/generated/node-schema.ts` | 15 | createNodeSchema wrapper |

**Total eliminated: ~2161 lines.** The entire libs/ag-schema/ directory was removed.

## What was generated instead

One new file: `ast-schema/generated/schema.ts` (585 lines, replaces 1846 lines of node-defs.ts + node-schema.ts).
No imports from any library — pure generated static code with:
- Internal `C` table mapping complex node kinds to their child field names
- `getChildren(node)` — the only function production code needs
- `allKinds` — Set of all 364 kind strings (test convenience)
- `getChildFields(kind)` — child field introspection (test convenience)

## Steps (all complete)

### Step 1: Add `generateSchema()` to codegen.ts ✓

Replaced `generateNodeDefs()`, `generateNodeSchema()`, and `fieldBuilderCall()` with a single
`generateSchema()` function. Updated `files` array to emit `schema.ts` instead of `node-defs.ts`
and `node-schema.ts`.

### Step 2: Update `generateIndex()` ✓

Replaced `ksNodeSchema`/`allNodeDefs`/364 `*Def` re-exports with:
```typescript
export { getChildren, allKinds, getChildFields } from './schema.js';
```

### Step 3b: Collapse node-defs.ts into ast.ts ✓

`src/pipeline/ast.ts` now exports both types and runtime schema:
```typescript
export { type KSNodeBase, type KSNode, getChildren, allKinds, getChildFields }
  from '../../ast-schema/generated/index.js';
export type * from '../../ast-schema/generated/node-types.js';
```

`src/pipeline/node-defs.ts` retained as backward-compat shim re-exporting from `./ast.js`.

### Step 4: Update test/node-schema.test.ts ✓

Rewrote to test generated exports (`allKinds`, `getChildFields`) instead of NodeSchema API.
Completeness checking done inline via Set filtering.

### Step 5: Update test imports ✓

All test files updated to import `getChildren` from `../src/pipeline/ast.js`:
- test/grammar.test.ts
- test/convert.test.ts
- test/checker.test.ts
- test/binder.test.ts
- test/builders.test.ts

### Step 6: Delete libs/ag-schema/ and update tsconfig ✓

Removed entire `libs/ag-schema/` directory. Removed `libs/ag-schema/src` from tsconfig `include`.

### Step 7: Run codegen + tests ✓

```
npx tsx ast-schema/codegen.ts   # ✓ generates schema.ts (585 lines)
npx vitest run                   # ✓ 148/148 tests pass
```

## Resulting architecture

```
ast-schema/
  schema.ts + builder.ts    (human-written, codegen-time only)
       |
  codegen.ts                 (reads registry, generates static code)
       |
  generated/                 (ZERO library dependencies for AST structure)
    node-types.ts              types, unions, guards
    schema.ts                  getChildren, allKinds, getChildFields
    convert.ts                 TS -> KS
    builders.ts                factory functions
    serialize.ts               JSON round-trip
    index.ts                   barrel

src/pipeline/
  ast.ts                     re-exports from generated/ (types + runtime schema)

libs/ag/                     generic AG runtime (unchanged, no AST knowledge)
  createGrammar(getChildren)   <-- getChildren comes from ast-schema
  createSemantics(grammar, specs)
  interpret(semantics, root)
```

**Rule: all AST/node structure comes from ast-schema/generated/.** libs/ag/ is purely AG runtime.
The only bridge is `getChildren` passed to `createGrammar()`.

No runtime library. No NodeDef objects. No createNodeSchema(). No phantom types at runtime.
Just generated static code.
