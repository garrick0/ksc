# Application Layer Implementation Plan

## Problem Statement

Cross-cutting coordination (evaluator wiring, program creation, codegen target
definitions) is duplicated across composition roots:

| Concern | `packages/core/index.ts` | `apps/cli/cli.ts` | `test/helpers/fixtures.ts` |
|---|---|---|---|
| Evaluator wiring (same 4 adapter imports + `createEvaluator` call) | Yes | Yes (word-for-word duplicate) | Yes (via `wireEvaluator`) |
| `createProgram()` function | Yes | Yes (duplicate, missing `getCompilationUnits`) | No (calls core's) |
| `parseOnly()` function | Yes | No | No |
| Codegen target definitions | No | Yes (in sibling `codegen-targets.ts`) | No |

As new entry points appear (IDE plugin, CI runner, programmatic API variants),
each must duplicate or import-chain the same wiring. The current architecture
has no designated location for shared application-level orchestration.

## Target Architecture

Introduce an `application/` directory at the project root that provides:

1. **Wiring modules** — pre-composed adapter combinations (evaluator, translator, codegen targets)
2. **Use case functions** — orchestration logic that coordinates ports via wiring
3. **Shared types** — application-level interfaces (KSProgramInterface)

```
BEFORE                                      AFTER
                                            application/
                                              wiring/
packages/core/index.ts   ─┐                    ts-kind-checking.ts    ← shared evaluator + translator
  (evaluator wiring)      │                    codegen-targets.ts     ← moved from apps/cli/
  (createProgram)         │ duplicated        check-program.ts        ← single createProgram
  (parseOnly)             │                   parse-only.ts           ← single parseOnly
apps/cli/cli.ts          ─┘                   run-codegen.ts          ← moved from apps/cli/pipeline.ts
  (evaluator wiring)                          types.ts                ← KSProgramInterface
  (createProgram)                             index.ts                ← barrel
  (codegen-targets.ts)
  (pipeline.ts)

packages/core/index.ts   → thin re-export of application/ + annotations
apps/cli/cli.ts          → thin CLI shell, imports from application/
test/helpers/fixtures.ts → imports wiring from application/
```

### Layer Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  ENTRY POINTS (thin shells — CLI args, npm API, test setup) │
│  packages/core/   apps/cli/   apps/dashboard/   test/       │
└─────────────────────────┬───────────────────────────────────┘
                          │ imports
┌─────────────────────────▼───────────────────────────────────┐
│  APPLICATION (use cases + wiring — no framework deps)       │
│  application/check-program.ts                               │
│  application/parse-only.ts                                  │
│  application/run-codegen.ts                                 │
│  application/wiring/ts-kind-checking.ts                     │
│  application/wiring/codegen-targets.ts                      │
└─────────────────────────┬───────────────────────────────────┘
                          │ imports
┌─────────────────────────▼───────────────────────────────────┐
│  ADAPTERS (concrete implementations)                        │
│  adapters/grammar/grammar/ts-ast/                           │
│  adapters/grammar/ast-translator/ts-ast/                    │
│  adapters/analysis/spec/ts-kind-checking/                   │
│  adapters/analysis/spec/mock/                               │
└─────────────────────────┬───────────────────────────────────┘
                          │ implements
┌─────────────────────────▼───────────────────────────────────┐
│  PORTS (contracts — generic machinery)                      │
│  libs/grammar/    libs/analysis/    libs/evaluator/         │
└─────────────────────────────────────────────────────────────┘
```

### Dependency Rule

```
entry points → application → adapters → libs (ports)
                    ↘ libs (ports)
```

- `application/` may import from `adapters/` and `libs/`
- `application/` must NOT import from `packages/`, `apps/`, or `test/`
- `libs/` must NOT import from `application/`, `adapters/`, `apps/`, or `packages/`
- `adapters/` must NOT import from `application/`, `apps/`, or `packages/`

This is the same dependency rule as before, with `application/` inserted between
entry points and adapters.

---

## New Files

### 1. `application/wiring/ts-kind-checking.ts`

Pre-wired evaluator and translator for the TS kind-checking target.
Replaces the duplicate wiring in `packages/core/index.ts` and `apps/cli/cli.ts`.

```typescript
/**
 * Wiring: TS AST kind-checking — pre-composed evaluator + translator.
 *
 * Single source of truth for the concrete adapter wiring that the
 * TS kind-checking evaluation pipeline needs.
 */

// Concrete adapters
import { tsToAstTranslatorAdapter } from '../../adapters/grammar/ast-translator/ts-ast/convert.js';
import { grammar } from '../../adapters/grammar/grammar/ts-ast/index.js';
import { analysisSpec } from '../../adapters/analysis/spec/ts-kind-checking/spec.js';
import { dispatchConfig } from '../../adapters/analysis/spec/ts-kind-checking/generated/dispatch.js';
import { depGraph } from '../../adapters/analysis/spec/ts-kind-checking/generated/dep-graph.js';

// Generic machinery
import { createEvaluator } from '../../libs/evaluator/index.js';

// Types
import type { KSTree } from '../../adapters/grammar/ast-translator/ts-ast/convert.js';
import type { KSCompilationUnit } from '../../adapters/grammar/grammar/ts-ast/index.js';
import type { KindDefinition, Diagnostic } from '../../adapters/analysis/spec/ts-kind-checking/types.js';
import type { KSCAttrMap } from '../../adapters/analysis/spec/ts-kind-checking/generated/attr-types.js';
import type { AttributeDepGraph } from '../../libs/analysis/ports.js';

// ── Wire evaluator (singleton) ──────────────────────────────────────

export const evaluator = createEvaluator({
  dispatch: dispatchConfig,
  grammar,
  projections: analysisSpec.projections,
  setup: analysisSpec.setup,
});

// ── Re-exports for use case modules ─────────────────────────────────

export { tsToAstTranslatorAdapter, grammar, depGraph };

// ── Re-export types ─────────────────────────────────────────────────

export type { KSTree, KSCompilationUnit, KindDefinition, Diagnostic, KSCAttrMap, AttributeDepGraph };
```

**Why a wiring module, not dependency injection:**
- There's one TS grammar, one kind-checking spec, one dispatch config
- DI would add factory/injection ceremony with no concrete benefit
- If a second analysis target (e.g., complexity analysis) appears, it gets its own wiring file
- Tests that need different wiring can still use `wireEvaluator()` directly

### 2. `application/wiring/codegen-targets.ts`

Moved from `apps/cli/codegen-targets.ts` with unchanged content. The codegen
pipeline is now an application-layer use case, so its target definitions belong
here too.

```typescript
/**
 * Codegen target definitions — grammar/spec pairings for code generation.
 *
 * Each target bundles a grammar + analysis spec + output configuration.
 * The K type parameter links grammar and spec, preventing mismatched pairings.
 */

import * as path from 'path';
import { fileURLToPath } from 'url';

// TS AST adapters
import { grammar } from '../../adapters/grammar/grammar/ts-ast/index.js';
import { analysisSpec } from '../../adapters/analysis/spec/ts-kind-checking/spec.js';

// Mock adapters
import { grammar as mockGrammar } from '../../adapters/grammar/grammar/mock/index.js';
import { analysisSpec as mockAnalysisSpec } from '../../adapters/analysis/spec/mock/spec.js';

// Port types
import type { CodegenTarget } from '../../libs/analysis/index.js';
import type { TSNodeKind } from '../../adapters/grammar/grammar/ts-ast/nodes.js';
import type { KSCProjections } from '../../adapters/analysis/spec/ts-kind-checking/spec.js';
import type { MockKind } from '../../adapters/grammar/grammar/mock/nodes.js';
import type { MockProjections } from '../../adapters/analysis/spec/mock/spec.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** TS AST kind-checking codegen target. */
export const tsKindCheckingTarget: CodegenTarget<TSNodeKind, KSCProjections> = {
  grammar,
  spec: analysisSpec,
  outputDir: path.join(ROOT, 'adapters', 'analysis', 'spec', 'ts-kind-checking', 'generated'),
  generatedImports: {
    specImportPath: '../spec.js',
    grammarImportPath: '../../../../grammar/grammar/ts-ast/index.js',
    analysisImportPath: '../../../../../libs/analysis',
    evaluatorImportPath: '../../../../../libs/evaluator',
  },
};

/** Mock codegen target (testing). */
export const mockTarget: CodegenTarget<MockKind, MockProjections> = {
  grammar: mockGrammar,
  spec: mockAnalysisSpec,
  outputDir: path.join(ROOT, 'adapters', 'analysis', 'spec', 'mock', 'generated'),
  generatedImports: {
    specImportPath: '../spec.js',
    grammarImportPath: '../../../../grammar/grammar/mock/index.js',
    analysisImportPath: '../../../../../libs/analysis',
    evaluatorImportPath: '../../../../../libs/evaluator',
  },
};
```

### 3. `application/types.ts`

Shared application-layer types. `KSProgramInterface` moves here from
`packages/core/index.ts`.

```typescript
/**
 * Application-layer types — shared interfaces for use cases.
 */

import type { KSTree } from '../adapters/grammar/ast-translator/ts-ast/convert.js';
import type { KSCompilationUnit } from '../adapters/grammar/grammar/ts-ast/index.js';
import type { KindDefinition, Diagnostic } from '../adapters/analysis/spec/ts-kind-checking/types.js';
import type { AttributeDepGraph } from '../libs/analysis/ports.js';

/** Concrete program interface for the TS AST kind-checking target. */
export interface KSProgramInterface {
  getRootFileNames(): string[];
  getCompilationUnits(): KSCompilationUnit[];
  getKindDefinitions(): KindDefinition[];
  getDiagnostics(): Diagnostic[];
  getKSTree(): KSTree;
  getAttributeDepGraph(): AttributeDepGraph;
}
```

### 4. `application/check-program.ts`

The "check program" use case. Single implementation of `createProgram()` and
`createProgramFromTSProgram()`, replacing the duplicates.

```typescript
/**
 * Use case: Check program — parse TS, convert to KS AST, evaluate, project results.
 *
 * This is the primary use case for the TS kind-checking analysis.
 */

import ts from 'typescript';
import { evaluator, tsToAstTranslatorAdapter, depGraph } from './wiring/ts-kind-checking.js';
import type { KSProgramInterface } from './types.js';
import type { KindScriptConfig } from '../packages/kindscript/config.js';

/** Create a KindScript program from file paths. */
export function createProgram(
  rootNames: string[],
  config?: KindScriptConfig,
  options?: ts.CompilerOptions,
): KSProgramInterface {
  const tsProgram = ts.createProgram(rootNames, options ?? {});
  return createProgramFromTSProgram(tsProgram, config);
}

/** Create a KindScript program from an existing TypeScript program. */
export function createProgramFromTSProgram(
  tsProgram: ts.Program,
  config?: KindScriptConfig,
): KSProgramInterface {
  const depth = config?.analysisDepth ?? 'check';
  const ksTree = tsToAstTranslatorAdapter.convert(tsProgram, depth);
  const { definitions, diagnostics } = evaluator.evaluate(ksTree.root);

  return {
    getRootFileNames: () => ksTree.root.compilationUnits.map(cu => cu.fileName),
    getCompilationUnits: () => ksTree.root.compilationUnits,
    getKindDefinitions: () => definitions,
    getDiagnostics: () => diagnostics,
    getKSTree: () => ksTree,
    getAttributeDepGraph: () => depGraph,
  };
}
```

### 5. `application/parse-only.ts`

The "parse only" use case. Converts TS to KS AST without evaluation.

```typescript
/**
 * Use case: Parse only — convert TS AST to KS AST without analysis.
 */

import ts from 'typescript';
import { tsToAstTranslatorAdapter } from './wiring/ts-kind-checking.js';
import type { KSTree } from '../adapters/grammar/ast-translator/ts-ast/convert.js';

/** Parse-only pipeline — converts TS AST to KS AST without analysis. */
export function parseOnly(
  rootNames: string[],
  options?: ts.CompilerOptions,
): KSTree {
  const tsProgram = ts.createProgram(rootNames, options ?? {});
  return tsToAstTranslatorAdapter.convert(tsProgram);
}
```

### 6. `application/run-codegen.ts`

Moved from `apps/cli/pipeline.ts`. The codegen pipeline is a reusable use case —
any tool that needs to regenerate dispatch/attr-types can call it.

```typescript
/**
 * Use case: Run codegen pipeline — validate spec, compile analysis, write files.
 *
 * Pipeline stages:
 *   1. Grammar metadata (provided via CodegenTarget)
 *   2. Spec validation (attr dep consistency)
 *   3. Analysis compilation (spec → dispatch + attr-types + dep-graph)
 *   4. File output
 */

import * as fs from 'fs';
import * as path from 'path';

import { compileAnalysis, validateSpec, validateSpecConsistency } from '../libs/analysis/index.js';
import type { CodegenTarget, GeneratedFile } from '../libs/analysis/index.js';

// ── File output ─────────────────────────────────────────────────────

function writeFiles(dir: string, files: GeneratedFile[]): void {
  fs.mkdirSync(dir, { recursive: true });
  for (const file of files) {
    const outPath = path.join(dir, file.path);
    fs.writeFileSync(outPath, file.content, 'utf-8');
    const lineCount = file.content.split('\n').length;
    console.log(`  Generated ${file.path} (${lineCount} lines)`);
  }
}

// ── Pipeline ────────────────────────────────────────────────────────

/**
 * Run the codegen pipeline: validate → compile → write.
 * Returns false on validation errors.
 */
export function runCodegenPipeline(target: CodegenTarget): boolean {
  const { grammar, spec, outputDir, generatedImports } = target;

  // Stage 1: Grammar summary
  console.log('=== Grammar ===\n');
  console.log(`  ${grammar.allKinds.size} node kinds, ${Object.keys(grammar.sumTypeMembers).length} sum types`);

  // Stage 2: Spec validation (deps + grammar-aware consistency)
  console.log('\n=== Spec Validation ===\n');
  const diags = validateSpec(spec);
  if (diags.length === 0) {
    console.log('  All attribute dependencies are valid.');
  } else {
    for (const d of diags) {
      console.log(`  [${d.level}] ${d.message}`);
    }
    if (diags.some(d => d.level === 'error')) {
      console.error('\nValidation errors found — aborting analysis compilation.');
      return false;
    }
  }
  // Grammar-aware validation (equation kind refs, function names, exhaustiveness)
  validateSpecConsistency(grammar, spec.attrs);

  // Validate that equation and type sibling files exist
  if (generatedImports?.specImportPath) {
    const specImportPath = generatedImports.specImportPath;
    const equationsPath = generatedImports.equationsImportPath
      ?? specImportPath.replace(/\/spec\.js$/, '/equations/index.js');
    const resolvedEq = path.resolve(outputDir, equationsPath.replace(/\.js$/, '.ts'));
    if (!fs.existsSync(resolvedEq)) {
      console.warn(`  [warn] Equations file not found: ${resolvedEq}`);
      console.warn(`         (derived from specImportPath: ${specImportPath})`);
    }
  }

  // Stage 3: Analysis compilation
  console.log('\n=== Analysis Compilation ===\n');

  const result = compileAnalysis(grammar, spec, generatedImports);
  writeFiles(outputDir, [
    result.dispatchFile,
    result.attrTypesFile,
    result.depGraphFile,
  ]);

  console.log(`\n${result.attrs.length} attributes:`);
  for (const a of result.attrs) {
    console.log(`  ${a.name}: ${a.direction}`);
  }
  console.log(`\nEvaluation order: ${result.depGraph.order.join(', ')}`);
  console.log(`Edges: ${result.depGraph.edges.length}`);
  return true;
}
```

### 7. `application/index.ts`

Barrel for the application layer.

```typescript
/**
 * Application layer barrel — use cases and shared types.
 *
 * Use cases:
 *   createProgram, createProgramFromTSProgram  — check a TS project
 *   parseOnly                                  — parse without evaluation
 *   runCodegenPipeline                         — validate + compile + write generated files
 *
 * Wiring:
 *   wiring/ts-kind-checking.ts     — pre-composed evaluator + translator
 *   wiring/codegen-targets.ts      — codegen target definitions
 */

// Use cases
export { createProgram, createProgramFromTSProgram } from './check-program.js';
export { parseOnly } from './parse-only.js';
export { runCodegenPipeline } from './run-codegen.js';

// Types
export type { KSProgramInterface } from './types.js';
```

---

## Modified Files

### 1. `packages/core/index.ts` — thin re-export

Becomes a thin npm API surface that re-exports from `application/`.
All evaluator wiring and program creation logic is removed.

```typescript
/**
 * KindScript core — heavyweight npm entry point.
 *
 * This is the `kindscript/core` subpath export. Re-exports the
 * application-layer use cases plus lightweight annotations.
 */

// ── Application-layer use cases ─────────────────────────────────────
export { createProgram, createProgramFromTSProgram } from '../../application/check-program.js';
export { parseOnly } from '../../application/parse-only.js';
export type { KSProgramInterface } from '../../application/types.js';

// ── Re-export lightweight annotations (kindscript root) ─────────────
export { defineConfig } from '../kindscript/annotations.js';
export type { Kind, PropertySet, KindScriptConfig } from '../kindscript/annotations.js';

// ── Domain types ─────────────────────────────────────────────────────
export type { KindDefinition } from '../../adapters/analysis/spec/ts-kind-checking/types.js';
export type { Diagnostic } from '../../adapters/analysis/spec/ts-kind-checking/types.js';
```

**Changes:**
- Remove all adapter imports (grammar, translator, spec, dispatch, depGraph)
- Remove `createEvaluator` import and evaluator wiring
- Remove `createProgram`, `createProgramFromTSProgram`, `parseOnly` implementations
- Remove `KSProgramInterface` definition
- Add re-exports from `application/`
- Keep domain type re-exports (KindDefinition, Diagnostic) — these are part of the npm API surface

### 2. `apps/cli/cli.ts` — thin CLI shell

Remove all evaluator wiring and the local `createProgram` function.
Import from `application/` instead.

**Lines to remove:**
- Lines 27-38: All adapter imports (`tsToAstTranslatorAdapter`, `grammar`, `analysisSpec`, `dispatchConfig`, `depGraph`)
- Lines 34: `createEvaluator` import
- Lines 40-46: `const evaluator = createEvaluator({...})`
- Lines 48-65: Local `createProgram` function

**Lines to add:**
```typescript
import { createProgram } from '../../application/check-program.js';
```

**Lines to change in `runCodegen()`:**
```typescript
// Before:
const { runCodegenPipeline } = await import('./pipeline.js');
const { tsKindCheckingTarget, mockTarget } = await import('./codegen-targets.js');

// After:
const { runCodegenPipeline } = await import('../../application/run-codegen.js');
const { tsKindCheckingTarget, mockTarget } = await import('../../application/wiring/codegen-targets.js');
```

The CLI retains all CLI-specific concerns: argument parsing, config discovery,
file discovery, watch mode, output formatting, exit codes.

### 3. `test/helpers/fixtures.ts` — import wiring from application/

**Lines to change:**
```typescript
// Before:
import { tsToAstTranslatorAdapter } from '../../adapters/grammar/ast-translator/ts-ast/convert.js';
import { grammar } from '../../adapters/grammar/grammar/ts-ast/index.js';
import { analysisSpec } from '../../adapters/analysis/spec/ts-kind-checking/spec.js';
import { dispatchConfig } from '../../adapters/analysis/spec/ts-kind-checking/generated/dispatch.js';
import { wireEvaluator } from '../../libs/evaluator/index.js';

const evaluator = wireEvaluator({ grammar, spec: analysisSpec, dispatch: dispatchConfig });

// After:
import { evaluator, tsToAstTranslatorAdapter } from '../../application/wiring/ts-kind-checking.js';
```

The `createProgram` import from `packages/core` stays as-is (tests the npm API surface).
The `evaluator` import switches to the shared wiring module.

### 4. `examples/showcase.ts` — no change required

Already imports `tsToAstTranslatorAdapter` directly and `extractASTData` from
`apps/dashboard/extract.ts`. These are correct — the showcase does parse-only
(no evaluation) and feeds the dashboard. No change needed.

### 5. `examples/programmatic-api.ts` — no change required

Imports from `packages/core/index.js` which becomes a thin re-export.
The import path and API surface are unchanged.

---

## Deleted Files

### 1. `apps/cli/codegen-targets.ts` → moved to `application/wiring/codegen-targets.ts`

Delete after moving. The CLI's `runCodegen()` updates its dynamic import path.

### 2. `apps/cli/pipeline.ts` → moved to `application/run-codegen.ts`

Delete after moving. The CLI's `runCodegen()` updates its dynamic import path.

---

## Backward Compatibility & Redundancy Cleanup

### Removed duplication

| What | Was in | Now in | Action |
|---|---|---|---|
| Evaluator wiring (4 imports + `createEvaluator`) | `packages/core/index.ts`, `apps/cli/cli.ts` | `application/wiring/ts-kind-checking.ts` | Remove from both old locations |
| `createProgram()` | `packages/core/index.ts`, `apps/cli/cli.ts` | `application/check-program.ts` | Remove from both old locations |
| `parseOnly()` | `packages/core/index.ts` | `application/parse-only.ts` | Remove from old location |
| `KSProgramInterface` | `packages/core/index.ts` | `application/types.ts` | Remove from old location |
| Codegen targets | `apps/cli/codegen-targets.ts` | `application/wiring/codegen-targets.ts` | Delete old file |
| Codegen pipeline | `apps/cli/pipeline.ts` | `application/run-codegen.ts` | Delete old file |

### CLI `createProgram` discrepancy

The CLI's local `createProgram` was missing `getCompilationUnits()` compared to
the `packages/core` version. The unified version in `application/check-program.ts`
includes the full interface. This is a fix, not a regression.

### `wireEvaluator` in `libs/evaluator/`

**Keep it.** `wireEvaluator` is a legitimate convenience function in the evaluator
library — it's not backward compatibility. Tests that need custom wiring (e.g.,
mock evaluator tests) should continue using `wireEvaluator` directly. The
application wiring module uses `createEvaluator` directly (matching the current
`packages/core` approach) since it doesn't need spec validation at startup.

### `apps/dashboard/extract.ts`

**Keep it where it is.** The dashboard extraction is dashboard-specific — it
produces `ASTDashboardData` (a dashboard type) and only uses the grammar adapter
(no evaluator). Moving it to `application/` would create a dependency from
`application/` to `apps/dashboard/app/types.ts`, which violates the dependency rule.

---

## Implementation Steps

### Phase 1: Create application layer (additive only) — COMPLETE

No existing code changes — just add new files.

1. [x] Create `application/wiring/ts-kind-checking.ts`
2. [x] Create `application/wiring/codegen-targets.ts` (copy from `apps/cli/codegen-targets.ts`)
3. [x] Create `application/types.ts`
4. [x] Create `application/check-program.ts`
5. [x] Create `application/parse-only.ts`
6. [x] Create `application/run-codegen.ts` (copy from `apps/cli/pipeline.ts`)
7. [x] Create `application/index.ts`
8. [x] Add `"application"` to `tsconfig.json` `include` array

**Verified:** `npm run typecheck` passes — new files compile against existing adapters and libs.

### Phase 2: Switch consumers to application layer — COMPLETE

Update each consumer one at a time, verifying after each.

8. [x] Update `packages/core/index.ts` → re-export from `application/`
9. [x] **Verified:** `npm run typecheck` clean + `npx vitest run test/api/program.test.ts` — 8/8 pass
10. [x] Update `apps/cli/cli.ts` → import from `application/`
11. [x] **Verified:** `npm run typecheck` clean + `npx vitest run test/api/cli.test.ts` — 27/27 pass
12. [x] Update `test/helpers/fixtures.ts` → import evaluator from `application/wiring/`
13. [x] **Verified:** `npx vitest run --testTimeout=30000` — all 384 tests pass (28 files)

### Phase 3: Delete old files — COMPLETE

14. [x] Delete `apps/cli/codegen-targets.ts`
15. [x] Delete `apps/cli/pipeline.ts`
16. [x] **Verified:** `npm run typecheck` — clean, no dangling imports
17. [x] **Verified:** `npx vitest run --testTimeout=30000` — all 384 tests pass (28 files)
18. [x] **Verified:** `npm run codegen` — both targets (ts-kind-checking + mock) generate successfully

### Phase 4: Update documentation — COMPLETE

19. [x] Update `CLAUDE.md` — architecture overview, directory structure, codegen paths, conventions
20. [x] Update `MEMORY.md` — architecture section, design patterns
21. [x] Update this plan document with completion status

---

## Documentation Updates

### CLAUDE.md Changes

**Architecture Overview** — add application layer description:

> **Application layer** (`application/`): Use case functions and adapter wiring.
> Coordinates ports and adapters into reusable operations. Entry points
> (`packages/`, `apps/`) are thin shells that delegate to this layer.

**Directory Structure** — add `application/` section:

```
application/                      Application layer — use cases + wiring
  wiring/
    ts-kind-checking.ts           Pre-wired evaluator + translator for TS KC
    codegen-targets.ts            CodegenTarget definitions (ts-kind-checking + mock)
  check-program.ts                Use case: createProgram, createProgramFromTSProgram
  parse-only.ts                   Use case: parseOnly (convert without evaluation)
  run-codegen.ts                  Use case: runCodegenPipeline (validate + compile + write)
  types.ts                        KSProgramInterface
  index.ts                        Barrel
```

**Conventions** — update composition root conventions:

> - **Application layer** (`application/`) holds shared use cases and adapter wiring
> - **Entry points are thin shells** — `packages/core` re-exports from application layer;
>   `apps/cli` delegates to application-layer use cases
> - **Wiring modules** (`application/wiring/`) pre-compose adapters into reusable instances
> - **Use cases** (`application/*.ts`) orchestrate wiring + ports into domain operations

**Remove or update these existing conventions:**
> - ~~**Composition roots wire adapters directly** — no shared wiring module, no factory pattern~~
> - ~~**`packages/core/`** is the primary composition root — wires evaluator inline~~
> - ~~**`apps/cli/`** wires adapters directly; codegen targets in `apps/cli/codegen-targets.ts`~~
> - ~~**Codegen pipeline in `apps/cli/pipeline.ts`**~~

Replace with:
> - **`application/wiring/`** pre-composes adapters; entry points import from here
> - **`packages/core/`** is the npm API surface — thin re-export of `application/`
> - **`apps/cli/`** is the CLI shell — arg parsing, config, output formatting; delegates to `application/`
> - **Codegen pipeline** in `application/run-codegen.ts`; codegen targets in `application/wiring/codegen-targets.ts`

### MEMORY.md Changes

Update "Architecture" section to mention application layer.
Update "Key Design Patterns" to reflect the new composition approach.

---

## Verification Checklist — ALL PASSED

- [x] `npm run typecheck` — full project typechecks (including adapters/, application/)
- [x] `npx vitest run --testTimeout=30000` — all 384 tests pass (28 files)
- [x] `npm run codegen` — both targets (ts-kind-checking + mock) generate successfully
- [x] `npx vitest run test/api/program.test.ts` — 8/8 pass
- [x] `npx vitest run test/api/cli.test.ts` — 27/27 pass
- [x] `npx vitest run test/api/export.test.ts` — 9/9 pass
- [x] `npx vitest run test/e2e/e2e.test.ts` — 16/16 pass
- [x] `npx vitest run test/integration/` — all integration tests pass
- [x] Dependency rule holds — `application/` imports only from `adapters/` and `libs/` (no packages/ or apps/)
- [x] `tsconfig.json` includes `application/` in compilation

---

## Follow-Up Fixes (Post-Implementation)

All verified: typecheck clean, 384/384 tests pass, codegen works.

### 1. Dependency rule violation fixed — `KindScriptConfig` moved to application/

`application/check-program.ts` was importing `KindScriptConfig` from `packages/kindscript/config.js`
(application → packages, wrong direction). Fixed by:
- Moving `KindScriptConfig` + `defineConfig` to `application/types.ts` (canonical location)
- `packages/kindscript/config.ts` now re-exports from `application/types.ts`
- `application/check-program.ts` and `apps/cli/cli.ts` import from `application/types.js`

### 2. Dashboard extract imports grammar from application/wiring

`apps/dashboard/extract.ts` was importing `grammar` directly from
`adapters/grammar/grammar/ts-ast/index.js`. Switched to import from
`application/wiring/ts-kind-checking.js` for consistency (entry points → application).

### 3. Showcase uses `parseOnly` use case

`examples/showcase.ts` was manually calling `ts.createProgram()` +
`tsToAstTranslatorAdapter.convert()`. Switched to use `parseOnly()` from
`application/parse-only.ts`. Added optional `depth` parameter to `parseOnly`
(backward-compatible — defaults to no depth / parse level).

### 4. package.json scripts — verified OK

`npm run codegen` uses `tsx apps/cli/cli.ts codegen` which routes through
`apps/cli/cli.ts` → `application/run-codegen.ts`. No change needed.

### 5. Test `wireEvaluator` audit

- `test/integration/kind-checking.test.ts` — switched to `application/wiring/ts-kind-checking.ts`
  (was duplicating the exact same wiring)
- `test/adapters/convert.test.ts` — switched to `application/wiring/ts-kind-checking.ts`
  (was duplicating the exact same wiring)
- `test/adapters/mock-evaluator.test.ts` — kept `wireEvaluator` (legitimately wires
  mock grammar, which has no application wiring module)

### 6. Mock wiring module — not created

Only one test file (`mock-evaluator.test.ts`) wires the mock evaluator.
Creating `application/wiring/mock.ts` for a single test would be over-engineering.

---

## What This Does NOT Change

- **libs/** — no changes to port interfaces or generic machinery
- **adapters/** — no changes to adapter implementations or generated code
- **package.json exports** — npm subpath exports unchanged (`kindscript` and `kindscript/core`)
- **`wireEvaluator`** — stays in `libs/evaluator/`, available for custom wiring in tests
