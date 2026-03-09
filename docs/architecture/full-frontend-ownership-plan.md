# Full Frontend Ownership: Spec-Owned convert.ts Generation

Move convert.ts generation out of `grammar/compile.ts` entirely. The spec provides its own convert generator. `compile.ts` generates the other 6 files (node-types, schema, builders, serialize, kind-map, index), which are genuinely generic.

## Status: Complete

All steps implemented and verified:
- `tsc --noEmit` — clean
- `npx vitest run` — 262 tests pass across 21 files
- Both codegen targets (ts-kind-checking + mock) produce correct output
- Generated convert.ts content is functionally identical to pre-change output
- `grammar/compile.ts` contains zero TS-specific code (no `import ts`, no `ts.` references)

## The Problem

After the extractor module change (Option E), `grammar/compile.ts` has zero TS-specific *helper* code. But `generateConvert()` still emits ~200 lines of TS-specific *infrastructure*:

- `import ts from 'typescript'` — hardcoded
- `WeakMap<ts.Node, KS.KSNode>` — identity map keyed on TS nodes
- `toCommentRange(cr: ts.CommentRange)` — TS comment API
- `attachComments(...)` — `ts.getLeadingCommentRanges`, `ts.getTrailingCommentRanges`
- `findChild` / `findChildrenOf` — typed to `ts.Node`, `ts.NodeArray`
- `SpecificConverter` — typed to `(node: ts.Node, sf: ts.SourceFile, ...)`
- `convertNode()` — `ts.forEachChild`, `node.getStart(sf)`, `node.getText(sf)`
- `convertSourceFile()` — `ts.SourceFile`, `sf.fileName`, `sf.isDeclarationFile`, `sf.getLineStarts()`, `sf.languageVariant`, `ts.LanguageVariant.JSX`
- `buildKSTree()` — `ts.Program`, `tsProgram.getTypeChecker()`, `tsProgram.getSourceFiles()`
- Per-kind converters use `ts.SyntaxKind.X` for registration

Every generated convert.ts assumes a TypeScript AST as input. A non-TS grammar (Python, C#) would need completely different infrastructure — different tree walker, different comment API, different program entry point.

## What's Generic vs What's TS-Specific in generateConvert()

**Generic (data-driven from GrammarSpec):**
- Per-kind converter bodies: the `register()` call for each node kind, field extraction expressions from `getConvertFieldExpr()` — ~30 lines of generation logic, ~2800 lines of output
- The *pattern* of a converter registry with per-kind dispatch

**TS-specific (hardcoded in generation template):**
- All infrastructure: imports, identity map, comment handling, child lookup, converter types, central dispatch, tree building — ~120 lines of template
- `ts.SyntaxKind.X` in register calls (vs a generic kind-to-number mapping)

## Design

### Core Idea

`GrammarSpec` gets a new optional field: `convertGenerator`. When present, `compileGrammar` calls it to produce convert.ts content. When absent, convert.ts is not generated (or a fallback is used).

The convert generator receives the grammar data it needs (nodes, field extractors, skip set, syntax kind overrides) plus a shared helper for generating per-kind converter bodies, so specs don't reimplement the data-driven part.

### New Interface

```typescript
// grammar/types.ts

export interface ConvertGeneratorInput {
  nodes: ReadonlyMap<string, NodeEntry>;
  sumTypes: ReadonlyMap<string, SumTypeEntry>;
  fieldExtractors: Record<string, Record<string, string>>;
  skipConvert: ReadonlySet<string>;
  syntaxKindOverrides: Record<string, number>;
  jsDocMembers: ReadonlySet<string>;
}

export interface GrammarSpec {
  nodes: ReadonlyMap<string, NodeEntry>;
  sumTypes: ReadonlyMap<string, SumTypeEntry>;
  fieldExtractors: Record<string, Record<string, string>>;
  skipConvert?: ReadonlySet<string>;
  syntaxKindOverrides?: Record<string, number>;
  convertHelpers?: ConvertHelpersConfig;      // kept for backward compat
  convertGenerator?: ConvertGenerator;         // NEW
}

type ConvertGenerator = (input: ConvertGeneratorInput) => string;
```

### Shared Per-Kind Generation Helper

The per-kind converter bodies are data-driven and reusable. Extract `getConvertFieldExpr()` and the per-kind loop into a shared helper that any convert generator can call:

```typescript
// grammar/convert-codegen.ts (NEW — shared helper for convert generators)

export interface ConverterEntry {
  kind: string;
  syntaxKindExpr: string;   // e.g. "ts.SyntaxKind.Identifier" or "42 as ts.SyntaxKind"
  fields: Array<{ name: string; expr: string }>;  // field name → extraction expression
  isLeaf: boolean;
}

/**
 * Build per-kind converter entries from grammar spec data.
 * Returns one entry per node kind (minus skipConvert), with pre-computed
 * field extraction expressions.
 */
export function buildConverterEntries(input: ConvertGeneratorInput): ConverterEntry[];

/**
 * Emit register() calls as lines of TypeScript source code.
 * Uses a configurable syntaxKindFn to produce the kind expression for register().
 */
export function emitConverterRegistrations(
  entries: ConverterEntry[],
  opts?: { syntaxKindFn?: (kind: string) => string }
): string[];
```

This is the *only* piece the spec reuses from generic machinery. Everything else — imports, infrastructure, dispatch, tree building — is fully spec-owned.

### TS-AST Convert Generator

The TS spec provides its own convert generator:

```typescript
// specs/ts-ast/grammar/convert-generator.ts (NEW)

import type { ConvertGeneratorInput } from '../../../grammar/types.js';
import { buildConverterEntries, emitConverterRegistrations } from '../../../grammar/convert-codegen.js';

export function generateTsConvert(input: ConvertGeneratorInput): string {
  const entries = buildConverterEntries(input);
  const registrations = emitConverterRegistrations(entries, {
    syntaxKindFn: (kind) => {
      const override = input.syntaxKindOverrides[kind];
      return override !== undefined
        ? `${override} as ts.SyntaxKind`
        : `ts.SyntaxKind.${kind}`;
    },
  });

  return [
    preamble(input),       // imports, infrastructure, identity map, comment handling
    ...registrations,      // data-driven per-kind converters
    postamble(input),      // central dispatch, convertSourceFile, buildKSTree
  ].join('\n');
}

function preamble(input: ConvertGeneratorInput): string {
  // Full TS-specific infrastructure: import ts, WeakMap<ts.Node>,
  // toCommentRange, attachComments, findChild, findChildrenOf,
  // converter registry, initConvertHelpers import
  // ...
}

function postamble(input: ConvertGeneratorInput): string {
  // convertNode (ts.forEachChild), convertSourceFile, buildKSTree (ts.Program)
  // ...
}
```

### Mock Convert Generator

The mock spec can either:
1. Also provide a convert generator (replicating current behavior)
2. Not provide one — convert.ts isn't generated, mock tests use a different approach

Since the mock convert.ts is identical infrastructure (it also uses `ts.forEachChild` etc.), the mock would import and reuse the TS convert generator, or provide its own minimal one. The simplest path: both specs reuse the same TS-skeleton generator, since both currently target the TypeScript compiler API.

If a truly different frontend (Python) were added, it would provide its own convert generator with completely different infrastructure.

### Wire Into Spec

```typescript
// specs/ts-ast/grammar/spec.ts
import { generateTsConvert } from './convert-generator.js';

export function buildGrammarSpec(builder: GrammarBuilder): GrammarSpec {
  defineGrammar(builder);
  const { nodes, sumTypes } = builder.build();
  return {
    nodes,
    sumTypes,
    fieldExtractors: assembleFieldExtractors(nodes, { ... }),
    skipConvert: SKIP_CONVERT,
    syntaxKindOverrides: SYNTAX_KIND_OVERRIDES,
    convertGenerator: generateTsConvert,
    // convertHelpers field removed — now handled internally by convert-generator
  };
}
```

### Update compile.ts

```typescript
// grammar/compile.ts — compileGrammar()

export function compileGrammar(spec: GrammarSpec): CompiledGrammar {
  const ctx = buildCtx(spec);

  const files: GeneratedFile[] = [
    { path: 'node-types.ts', content: generateNodeTypes(ctx) },
    { path: 'schema.ts', content: generateSchema(ctx) },
    { path: 'builders.ts', content: generateBuilders(ctx) },
    { path: 'serialize.ts', content: generateSerializer(ctx) },
    { path: 'kind-map.ts', content: generateKindMap(ctx) },
    { path: 'index.ts', content: generateIndex(ctx) },
  ];

  // convert.ts — delegated to spec's convert generator
  if (spec.convertGenerator) {
    const convertContent = spec.convertGenerator({
      nodes: spec.nodes,
      sumTypes: spec.sumTypes,
      fieldExtractors: ctx.fieldExtractors ?? {},
      skipConvert: ctx.resolvedSkipConvert,
      syntaxKindOverrides: ctx.resolvedSyntaxKindOverrides,
      jsDocMembers: ctx.jsDocMembers,
    });
    files.push({ path: 'convert.ts', content: convertContent });
  }
  // No convertGenerator → no convert.ts generated (spec must provide it separately)

  // ...
}
```

### Remove From compile.ts

- Delete `generateConvert()` (~210 lines)
- Delete `getConvertFieldExpr()` (~30 lines) — moves to `grammar/convert-codegen.ts`
- Remove `ConvertHelpersConfig` from `GrammarSpec` (subsumed by convertGenerator)
- Remove the `convertHelpers` handling in `buildCtx`

## Implementation Steps

### Step 1: Create `grammar/convert-codegen.ts`
- [x] Extract `getConvertFieldExpr()` from `compile.ts`
- [x] Create `buildConverterEntries()` — builds the per-kind data
- [x] Create `emitConverterRegistrations()` — emits register() calls as source lines
- [x] Unit test the helper independently

### Step 2: Create `specs/ts-ast/grammar/convert-generator.ts`
- [x] Implement `generateTsConvert(input) → string`
- [x] Move infrastructure templates (preamble/postamble) from compile.ts
- [x] Import `initConvertHelpers` and helpers (currently in convert-helpers.ts) — the import statement is part of the preamble
- [x] Wire `syntaxKindFn` for `ts.SyntaxKind.X` expressions
- [x] Verify output matches current generated convert.ts (diff should be empty after regeneration)

### Step 3: Update `specs/ts-ast/grammar/spec.ts`
- [x] Import `generateTsConvert`
- [x] Add `convertGenerator: generateTsConvert` to the GrammarSpec return
- [x] Remove `convertHelpers` field (subsumed by the generator)

### Step 4: Update mock spec
- [x] Either: mock reuses the TS convert generator (simplest since mock also targets TS)
- [x] Or: mock provides its own minimal convert generator
- [x] Verify mock convert.ts output matches current

### Step 5: Update `grammar/compile.ts`
- [x] Remove `generateConvert()` function
- [x] Remove `getConvertFieldExpr()` helper
- [x] Update `compileGrammar()` to call `spec.convertGenerator` if present
- [x] Remove convert.ts from the hardcoded file list

### Step 6: Update `grammar/types.ts`
- [x] Add `ConvertGeneratorInput` interface
- [x] Add `convertGenerator?: ConvertGenerator` to GrammarSpec
- [x] Remove `ConvertHelpersConfig` and `convertHelpers?` (subsumed)

### Step 7: Update `grammar/index.ts` barrel export
- [x] Export `ConvertGeneratorInput` type
- [x] Export shared helpers from `convert-codegen.ts` (for spec authors)

### Step 8: Regenerate and verify
- [x] `npx tsx app/codegen/ts-kind-checking.ts` — regenerate all
- [x] Diff generated convert.ts — should be identical to pre-change
- [x] `npx tsx app/codegen/mock.ts` — regenerate mock
- [x] `tsc --noEmit` — clean
- [x] `npx vitest run` — all tests pass

### Step 9: Clean up
- [x] Remove dead code from compile.ts
- [x] Update CLAUDE.md directory structure if needed
- [x] Update this plan document with results

## File Changes Summary

| File | Change |
|------|--------|
| `grammar/convert-codegen.ts` | **NEW** — shared per-kind generation helpers (`getConvertFieldExpr`, `buildConverterEntries`, `emitConverterRegistrations`, `ConvertGeneratorInput`) |
| `specs/ts-ast/grammar/convert-generator.ts` | **NEW** — TS convert.ts generator (preamble + postamble + uses shared helpers) |
| `specs/mock/grammar/convert-generator.ts` | **NEW** — mock convert.ts generator (no helpers/checker init) |
| `specs/ts-ast/grammar/spec.ts` | Replaced `convertHelpers` with `convertGenerator: generateTsConvert` |
| `specs/mock/grammar/spec.ts` | Added `convertGenerator: generateMockConvert` |
| `grammar/compile.ts` | Removed `generateConvert()`, `getConvertFieldExpr()` (~240 lines deleted), delegates to `spec.convertGenerator` |
| `grammar/types.ts` | Added `ConvertGenerator` type, removed `ConvertHelpersConfig` interface and `convertHelpers?` field |
| `grammar/index.ts` | Re-exports `ConvertGenerator`, `ConvertGeneratorInput`, `ConverterEntry`, shared helpers |
| `test/compile-grammar.test.ts` | Updated to use a test convert generator (specs now own convert.ts generation) |

## Backward Compatibility

The `convertHelpers` field on GrammarSpec is removed — it's subsumed by the convert generator (which handles its own imports internally). Since `convertHelpers` was only added in the previous change and there are no external consumers, this is safe.

If backward compat is desired, `convertHelpers` could be kept and `generateConvert()` retained as a fallback when `convertGenerator` is not provided. But this adds complexity for no real benefit.

## What This Achieves

After this change:
- `grammar/compile.ts` contains zero TS-specific code — not in helpers (already done), not in infrastructure
- `grammar/compile.ts` generates 6 genuinely generic files: node-types, schema, builders, serialize, kind-map, index
- The TS AST convert generator lives in `specs/ts-ast/grammar/convert-generator.ts` — fully spec-owned
- Adding a non-TS grammar (Python AST, C# AST) requires zero changes to `grammar/compile.ts`
- The shared `convert-codegen.ts` helper provides the data-driven per-kind generation so specs don't reimplement it
- `convert-helpers.ts` (extractor functions) remains unchanged — it's imported by the generated convert.ts

## What Stays TS-Specific Outside grammar/

- `app/lib/program.ts`, `app/lib/parse.ts` — TS program creation and parsing. These are application code, not grammar machinery.

## Follow-up Improvements (Completed)

All five follow-up improvements from the original plan have been implemented:

### 1. DRY Convert Generators
- Created `grammar/convert-skeleton.ts` — shared TS-frontend infrastructure template (`emitConvertPreamble`, `emitConvertPostamble`)
- Both TS and mock convert generators now use the skeleton instead of duplicating ~120 lines of template code
- Configuration via `ConvertSkeletonConfig`: optional helper imports + buildKSTree init

### 2. Simplified GrammarSpec
- Removed `fieldExtractors`, `skipConvert`, `syntaxKindOverrides` from GrammarSpec
- Changed `ConvertGenerator` from `(input: ConvertGeneratorInput) => string` to `() => string`
- Spec factories create closures that capture all convert-specific data
- GrammarSpec is now minimal: `{ nodes, sumTypes, convertGenerator? }`

### 3. Moved verify.ts to specs/ts-ast/
- `grammar/verify.ts` → `specs/ts-ast/grammar/verify.ts`
- `CodegenConfig.supportsVerify` → `CodegenConfig.verifier` (function injection)
- Composition root imports verifier and passes it to config
- `grammar/` directory is now 100% TS-free

### 4. Expression String Validation
- Added `validateFieldExpressions(fieldExtractors, knownHelpers)` to `grammar/convert-codegen.ts`
- Scans expression strings for function-call-like patterns
- Checks against provided set of known helper names
- TS spec factory calls this during construction, warns on unknown references

### 5. Unit Tests for convert-helpers.ts
- Created `test/convert-helpers.test.ts` — 27 tests
- Tests: extractJSDocComment, getDeclarationKind, operator maps, checkIsDefinitionSite, isNodeExported, hasSymFlag, getLocalCount, getTypeString
