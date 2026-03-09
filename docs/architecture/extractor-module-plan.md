# Option E: Extractor Module Implementation Plan

Move ~200 lines of TypeScript-specific helper functions from `grammar/compile.ts` (generic machinery) to `specs/ts-ast/grammar/convert-helpers.ts` (spec-owned extractor module). Generated `convert.ts` imports helpers instead of defining them inline.

## Status: Complete

All steps implemented and verified:
- `tsc --noEmit` — clean
- `npx vitest run` — 262 tests pass across 21 files
- Both codegen targets (ts-kind-checking + mock) produce correct output
- Generated convert.ts imports from spec-owned helpers module
- Mock convert.ts has no helpers import (correctly omitted)

## The Problem

`grammar/compile.ts` contained TS-specific helper functions hardcoded as template strings inside `generateConvert()`. These were emitted verbatim into `generated/ts-ast/grammar/convert.ts`. This made "generic" machinery TS-specific.

**Functions moved** (all referenced by expression strings in `extractors.ts`):
- `hasSymFlag` — symbol flag checking via ts.TypeChecker
- `checkIsDefinitionSite` — parent-chain walking for binding positions
- `getResolvedFileName` — alias symbol → source file resolution
- `isNodeExported` — export modifier detection
- `getLocalCount` — scope container local count
- `getTypeString` — type checker string
- `getResolvedModulePath` — import module file resolution
- `getImportModuleSpecifier` — import specifier text extraction
- `isImportReference` — value-position import usage detection
- `extractJSDocComment` — JSDoc comment extraction
- `getDeclarationKind` — NodeFlags → var/let/const decoding
- 5 operator maps (prefix, postfix, type, heritage, meta-property)

**Functions that stayed** (generic dispatch infrastructure):
- `findChild` / `findChildrenOf` — WeakMap child lookup
- `toCommentRange` / `attachComments` — comment attachment
- `convertNode` — dispatch + recursive child conversion
- `convertSourceFile` — SourceFile → CompilationUnit
- `buildKSTree` — entry point (calls init when helpers configured)
- `register` + `SpecificConverter` — converter registry

## Implementation Steps

### Step 1: Create `specs/ts-ast/grammar/convert-helpers.ts`
- [x] Move all TS-specific helpers and operator maps
- [x] Export `initConvertHelpers(checker, depth)` to set module state
- [x] Export all helper functions referenced by expression strings
- [x] Export all operator maps

### Step 2: Add `convertHelpers` to GrammarSpec
- [x] Add `ConvertHelpersConfig` interface + optional field to `GrammarSpec` in `grammar/types.ts`

### Step 3: Update `grammar/compile.ts` generateConvert()
- [x] When `convertHelpers` provided: emit `import { ... } from '...'` instead of inline helpers
- [x] Remove hardcoded helper strings — replaced with import
- [x] Keep generic infrastructure (WeakMap, dispatch, child lookup, comments)
- [x] Modify emitted `buildKSTree` to call `initConvertHelpers(checker, depth)` only when helpers configured
- [x] When no `convertHelpers`: emit simpler `buildKSTree` (no checker, no init)

### Step 4: Wire spec to use `convertHelpers`
- [x] Update `specs/ts-ast/grammar/spec.ts` to include `convertHelpers` field
- [x] Point modulePath to `../../../specs/ts-ast/grammar/convert-helpers.js`

### Step 5: Regenerate and test
- [x] `npx tsx app/codegen/ts-kind-checking.ts` — regenerated successfully
- [x] `npx tsx app/codegen/mock.ts` — mock still works (no helpers import)
- [x] `npx vitest run` — 262 tests pass across 21 files
- [x] `tsc --noEmit` — clean

### Step 6: Update docs
- [x] Updated this plan document with results

## GrammarSpec Interface Change

```typescript
export interface GrammarSpec {
  nodes: ReadonlyMap<string, NodeEntry>;
  sumTypes: ReadonlyMap<string, SumTypeEntry>;
  fieldExtractors: Record<string, Record<string, string>>;
  skipConvert?: ReadonlySet<string>;
  syntaxKindOverrides?: Record<string, number>;
  convertHelpers?: ConvertHelpersConfig;  // NEW
}

export interface ConvertHelpersConfig {
  modulePath: string;      // import path for generated convert.ts
  exports: string[];       // named exports to import
  initFn?: string;         // init function name (default: 'initConvertHelpers')
}
```

## State Management

Before: `_checker` and `_depth` were module globals in generated `convert.ts`, set by `buildKSTree`.

After:
- `convert-helpers.ts` owns `_checker` and `_depth` as module state
- Exports `initConvertHelpers(checker, depth)` to set them
- Generated `buildKSTree` creates checker and calls `initConvertHelpers(checker, depth)` before converting
- When no helpers configured (mock), `buildKSTree` doesn't create checker or call init
- Generic infrastructure (dispatch, child lookup) doesn't need checker/depth

## File Changes Summary

| File | Change |
|------|--------|
| `specs/ts-ast/grammar/convert-helpers.ts` | **NEW** — 170 lines, all TS-specific helpers + init function |
| `grammar/types.ts` | Added `ConvertHelpersConfig` interface + `convertHelpers?` to GrammarSpec |
| `grammar/compile.ts` | Removed ~200 lines of hardcoded helpers, emit import + init call conditionally |
| `specs/ts-ast/grammar/spec.ts` | Added `convertHelpers` field listing 16 exports |
| `generated/ts-ast/grammar/convert.ts` | Regenerated — imports from helpers module (2928 lines, was 3115) |
| `generated-mock/mock/grammar/convert.ts` | Regenerated — unchanged behavior (no convertHelpers) |

## Result

`grammar/compile.ts` is now fully generic — it contains zero TypeScript-specific code. All language-specific helper functions live in `specs/ts-ast/grammar/convert-helpers.ts`, owned by the spec author. Adding a new grammar target (e.g., Python AST) requires no changes to `grammar/compile.ts` — just a new spec with its own `convert-helpers.ts`.
