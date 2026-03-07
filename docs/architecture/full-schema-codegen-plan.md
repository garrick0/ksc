# Full AST Schema with Codegen — Implementation Plan

> **Note:** This plan has been fully implemented. Additionally, `libs/ag-schema`
> was subsequently eliminated — `node-defs.ts` and `node-schema.ts` no longer
> exist. The codegen now generates a single `schema.ts` with pure static code
> (no runtime library). See [`eliminate-ag-schema-plan.md`](eliminate-ag-schema-plan.md).

## Goal

Replace the current partially-typed `defineNode()` definitions and hand-written `ast.ts`
interfaces with a single authoritative TS schema file that:

1. **Fully types all 360 nodes** — every child field has its correct type (not `any`)
2. **Defines sum types** — full TypeScript hierarchy including `LeftHandSideExpression`, `PrimaryExpression`, etc.
3. **Generates all downstream artifacts** via a codegen script
4. **Verifies against TypeScript's own AST** — automated check that our schema matches tsc

## Decisions

| Decision | Choice |
|----------|--------|
| **Schema format** | Option C: TS file with builder functions, evaluated at codegen time |
| **What to generate** | Option B: Generate everything (types, defs, schema, guards) |
| **Type info source** | Option D: Hand-write schema, verify programmatically against TS |
| **Sum type granularity** | Option B: Full TypeScript hierarchy (~20+ sum types) |
| **Leaf representation** | Option A: List all individually |
| **Directory** | New top-level `ast-schema/` directory |

## Directory Structure

```
ast-schema/
  builder.ts           ← schema builder helpers (sumType, node, leaf)
  schema.ts            ← THE source of truth (all 360 nodes, hand-written)
  codegen.ts           ← script: imports schema, generates output files
  verify.ts            ← script: compares schema against TypeScript's AST
  generated/           ← all generated output
    node-types.ts      ← interfaces, union types, type guards
    node-defs.ts       ← defineNode() calls with full phantom types
    node-schema.ts     ← runtime schema, getChildren, allNodeDefs
    index.ts           ← barrel re-export

src/pipeline/
  ast.ts               ← becomes thin re-export from ast-schema/generated/
```

## Sum Types (Full TypeScript Hierarchy)

### Expression hierarchy (nested)
- `Expression` — all expression nodes
  - `UnaryExpression` — subset
    - `UpdateExpression` — subset
      - `LeftHandSideExpression` — subset
        - `MemberExpression` — subset
          - `PrimaryExpression` — subset

### Declaration hierarchy
- `Declaration` — all declaration nodes
- `DeclarationStatement` — declarations that are also statements
- `FunctionLikeDeclaration` — function, method, constructor, accessor, arrow, function expression
- `ClassLikeDeclaration` — class declaration, class expression
- `ObjectTypeDeclaration` — interface, class, type literal
- `SignatureDeclaration` — call sig, construct sig, method sig, function type, constructor type

### Other categories
- `Statement` — all statement nodes
- `TypeNode` — all type annotation nodes
- `ClassElement` — class members
- `TypeElement` — interface/type literal members
- `Token` — operator/punctuation tokens
- `Keyword` — keyword tokens
- `Modifier` — modifier keywords (public, private, static, etc.)
- `Literal` — literal expressions
- `BindingPattern` — destructuring patterns
- `BindingName` — Identifier | BindingPattern
- `PropertyName` — Identifier | StringLiteral | NumericLiteral | ComputedPropertyName | PrivateIdentifier
- `EntityName` — Identifier | QualifiedName
- `ObjectLiteralElement` — property assignment, shorthand, spread, method, accessor
- `JsxChild` — JSX element children
- `JsxAttributeLike` — JSX attributes

## Progress

- [x] Plan document written
- [x] Decisions finalized
- [x] Phase 1: Builder library (`ast-schema/builder.ts`)
- [x] Phase 2: Schema file (`ast-schema/schema.ts`) — 364 nodes, 48 sum types
- [x] Phase 3: Codegen script (`ast-schema/codegen.ts`)
- [x] Phase 4: Run codegen — generates node-types.ts (3391 lines), node-defs.ts (1806 lines), node-schema.ts, index.ts
- [x] Phase 5: Verification — 362/362 TS kinds covered, 0 errors, 0 warnings
- [x] Phase 6: Wire up imports — node-defs.ts re-exports from generated, 107 tests pass, 0 new tsc errors
- [x] Phase 7: Cleanup — removed old scripts/gen-node-defs.ts
- [x] Phase 8: Schema completeness — added missing fields, typed all child refs, decoded operator enums, upgraded JSDoc leaves
- [x] Phase 9: Comprehensive audit — automated comparison against TS compiler, added 19 missing fields, 1 new sum type (JsxChild)

## Migration Notes

### Current state (complete)
- `ast-schema/schema.ts` is the single source of truth (364 nodes, 48 sum types)
- `ast-schema/builder.ts` supports `sumTypeIncludes()` for composite sum types (e.g., `ForInitializer` includes all `Expression` members)
- `ast-schema/codegen.ts` generates strictly-typed output in `ast-schema/generated/`
- `src/pipeline/node-defs.ts` re-exports `getChildren`, `ksNodeSchema`, `allNodeDefs` from generated code
- `src/pipeline/ast.ts` is a thin re-export from `ast-schema/generated/`
- `src/pipeline/convert.ts` uses strict generated types with generic `findChild<T>` / `findChildrenOf<T>` helpers
- All child/optChild fields are typed (no untyped `child()` calls remain)
- All operator/token enum fields use decoded string literals instead of raw numbers
- 11 JSDoc nodes upgraded from leaf to structured with proper fields
- Import attributes fully supported on ImportDeclaration/ExportDeclaration/ImportType
- 453 fields across 188 complex nodes (up from ~400 across ~176)
- Comprehensive Phase 2 audit added 19 missing child/property fields verified against TS compiler
- `ast-schema/verify.ts` verifies 362/362 TS SyntaxKinds covered with 0 errors
- 107 tests pass, 0 new tsc type errors
