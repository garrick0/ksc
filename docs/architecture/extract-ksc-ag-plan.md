# Plan: Four-Module AG Architecture

> **Status: COMPLETE.** All steps implemented. `libs/ag/` split into `ag-behavior/` +
> `ag-interpreter/`. KSC specs and domain types extracted to `ksc-behavior/`. KSC
> orchestration in `ksc-interpreter/`. `src/` has zero imports from `ag-*` or `libs/ag/`.
> All 131 tests pass. All verification checks pass.

## Goal

Split the current monolithic `libs/ag/` and scattered KSC AG code into four
purpose-specific modules:

```
ast-schema/         ← data: what the tree looks like           (depends on: nothing)
ag-behavior/        ← generic AG behavior vocabulary           (depends on: nothing)
ag-interpreter/     ← generic AG evaluation engine             (depends on: ag-behavior)
ksc-behavior/       ← KSC-specific specs + domain types        (depends on: ast-schema, ag-behavior)
ksc-interpreter/    ← KSC-specific orchestration               (depends on: ast-schema, ksc-behavior, ag-interpreter)
src/                ← app: public API + program creation        (depends on: ast-schema, ksc-behavior, ksc-interpreter)
```

`src/` has zero imports from `ag-behavior/`, `ag-interpreter/`, or `libs/ag/`.
Tests may import from any module as needed.

## Current state

AG concerns are scattered across `libs/ag/` (monolithic, 6 files, ~700 lines) and
four locations in `src/`:

| File | What it has | Lines |
|------|------------|-------|
| `libs/ag/src/spec.ts` | AG vocabulary: SpecInput, AttrDecl, ProductionEquations | 88 |
| `libs/ag/src/compile.ts` | Attribute compilation: compile(), installLazy, makeDispatch | 338 |
| `libs/ag/src/grammar.ts` | Tree structure: createGrammar, Grammar | 40 |
| `libs/ag/src/semantics.ts` | Spec merging: createSemantics, Semantics, topoSort | 139 |
| `libs/ag/src/interpret.ts` | Evaluation: interpret, stampTree, applyAttributes | 155 |
| `libs/ag/src/analyze.ts` | Dependency analysis: analyzeDeps | 199 |
| `libs/ag/src/serialize.ts` | Tree serialization: serializeTree, deserializeTree | 148 |
| `libs/ag/src/index.ts` | Barrel re-exports | 39 |
| `src/pipeline/binder.ts` | Binder spec (SpecInput<KSNode>) | 135 |
| `src/pipeline/checker.ts` | Checker spec (SpecInput<KSNode>) | 247 |
| `src/pipeline/types.ts` | Domain types + KSProgramInterface | 69 |
| `src/api/kinds.ts` | User-facing kind API: Kind<>, PropertySet | 32 |
| `src/program.ts` lines 44-91 | AG orchestration: grammar → semantics → interpret → analyzeDeps | ~48 |

Every consumer (program.ts, binder.test.ts, checker.test.ts, grammar.test.ts)
independently imports from `libs/ag/` and repeats the `grammar → semantics → interpret`
wiring. There are 5 separate call sites doing this same orchestration.

## Target architecture

### `ag-behavior/` — Generic AG behavior vocabulary

The primitives for **defining** attribute grammar specifications. This is the
author-facing API — the vocabulary of attribute kinds, how specs are structured,
how declarations and equations are expressed.

```
ag-behavior/
  spec.ts       ← SpecInput, AttrDecl (Syn/Inh/Circular/Collection/ParamSyn), ProductionEquations
  index.ts      ← barrel
```

**Depends on:** nothing.

This module is purely types and type-level helpers today, but will grow as we add:
- New attribute kinds (reference attributes, parameterized inherited, etc.)
- Typed equation builder APIs
- Spec validation at the type level

#### `ag-behavior/spec.ts`

Direct copy of `libs/ag/src/spec.ts`. No changes needed — no internal imports.

#### `ag-behavior/index.ts`

```typescript
export type {
  AttrDecl, SynDecl, InhDecl, CircularDecl, ParamSynDecl, CollectionDecl,
  ProductionEquations, SpecInput,
} from './spec.js';
```

### `ag-interpreter/` — Generic AG evaluation engine

The machinery for **evaluating** AG specifications on trees. Takes behavior
definitions (from ag-behavior) and actually makes them run: compilation,
tree traversal, attribute installation, dependency analysis, serialization.

```
ag-interpreter/
  compile.ts    ← compile(), installLazy, AttributeDef, makeDispatch
  grammar.ts    ← createGrammar(), Grammar
  semantics.ts  ← createSemantics(), Semantics, SealedSpec, topoSort
  interpret.ts  ← interpret(), stampTree(), applyAttributes(), StampedNode
  analyze.ts    ← analyzeDeps(), DepGraph, AnalysisResult
  serialize.ts  ← serializeTree(), deserializeTree(), SerializeOptions
  index.ts      ← barrel
```

**Depends on:** ag-behavior (for AttrDecl, SpecInput types).

#### Import changes from `libs/ag/src/`

Most files have only internal imports (`./grammar.js`, `./compile.js`, etc.) that
become same-directory imports in ag-interpreter/. Only two files import from spec.ts:

**`compile.ts`** — one import change:
```typescript
// Was: import type { AttrDecl, SynDecl, InhDecl, CircularDecl, CollectionDecl } from './spec.js';
import type { AttrDecl, SynDecl, InhDecl, CircularDecl, CollectionDecl } from '../ag-behavior/spec.js';
```

**`semantics.ts`** — one import change:
```typescript
// Was: import type { SpecInput, AttrDecl } from './spec.js';
import type { SpecInput, AttrDecl } from '../ag-behavior/spec.js';
```

All other files (`grammar.ts`, `interpret.ts`, `analyze.ts`, `serialize.ts`) have
only same-directory imports and need no changes.

#### `ag-interpreter/index.ts`

```typescript
// Compilation
export { compile, installLazy } from './compile.js';
export type { AttributeDef, AttributeMap } from './compile.js';

// Grammar
export { createGrammar } from './grammar.js';
export type { Grammar } from './grammar.js';

// Semantics
export { createSemantics } from './semantics.js';
export type { Semantics, SealedSpec } from './semantics.js';

// Interpreter + tree primitives
export { interpret, stampTree, applyAttributes } from './interpret.js';
export type { StampedNode } from './interpret.js';

// Dependency analysis
export { analyzeDeps } from './analyze.js';
export type { DepGraph, AnalysisResult } from './analyze.js';

// Serialization
export { serializeTree, deserializeTree } from './serialize.js';
export type { SerializeOptions } from './serialize.js';
```

### `ksc-behavior/` — KSC-specific specs + domain types

The KSC-specific behavior: **what** to compute over the KSC AST. Contains the
specs (binder, checker), their domain types, and the user-facing kind API.

```
ksc-behavior/
  types.ts      ← KindDefinition, CheckerDiagnostic, PropertySet, Kind<>, AttributeDepGraph
  binder.ts     ← createBinderSpec()
  checker.ts    ← createCheckerSpec()
  index.ts      ← barrel
```

**Depends on:** ast-schema (for KSNode types), ag-behavior (for SpecInput).

#### `ksc-behavior/types.ts`

Merges `src/api/kinds.ts` + AG domain types from `src/pipeline/types.ts`:

```typescript
import type { KSNode, KSTypeAliasDeclaration } from '../ast-schema/generated/index.js';

// From api/kinds.ts
export interface PropertySet { readonly noImports?: true; }
export type Kind<R extends PropertySet> = { readonly __kind?: R };

// From pipeline/types.ts
export interface KindDefinition { id: string; name: string; properties: PropertySet; node: KSTypeAliasDeclaration; }
export interface CheckerDiagnostic { node: KSNode; message: string; kindName: string; property: string; pos: number; end: number; fileName: string; }
export interface AttributeDepGraph { attributes: string[]; edges: [string, string][]; order: string[]; specOwnership: Record<string, string>; declarations: Record<string, { direction: string }>; }
```

`KSProgramInterface` stays in `src/pipeline/types.ts` — it's the app-level API.

#### `ksc-behavior/binder.ts`

Move from `src/pipeline/binder.ts`. Import path changes:
- `PropertySet` from `./types.js` (was `../api/kinds.js`)
- `KindDefinition` from `./types.js` (was `./types.js`)
- AST types from `../ast-schema/generated/index.js` (was `./ast.js`)
- `SpecInput` from `../ag-behavior/index.js` (was `../../libs/ag/src/spec.js`)

#### `ksc-behavior/checker.ts`

Move from `src/pipeline/checker.ts`. Same import path pattern as binder.

#### `ksc-behavior/index.ts`

```typescript
// Domain types
export type { KindDefinition, CheckerDiagnostic, AttributeDepGraph, PropertySet, Kind } from './types.js';

// Specs
export { createBinderSpec } from './binder.js';
export { createCheckerSpec } from './checker.js';
```

### `ksc-interpreter/` — KSC-specific orchestration

The KSC-specific orchestration: **how** to evaluate KSC behavior on KSC data.
Wires ast-schema (data) + ksc-behavior (specs) through ag-interpreter (engine).
Also re-exports AG primitives that `src/` needs, so `src/` never touches `ag-*`.

```
ksc-interpreter/
  evaluate.ts   ← evaluate(root): EvaluationResult
  index.ts      ← barrel + re-exports of AG primitives for src/
```

**Depends on:** ast-schema, ksc-behavior, ag-interpreter.

#### `ksc-interpreter/evaluate.ts`

Extracts AG orchestration from `src/program.ts` (lines 44-91):

```typescript
import type { KSNode } from '../ast-schema/generated/index.js';
import { getChildren } from '../ast-schema/generated/index.js';
import { createGrammar } from '../ag-interpreter/grammar.js';
import { createSemantics } from '../ag-interpreter/semantics.js';
import { interpret } from '../ag-interpreter/interpret.js';
import { analyzeDeps } from '../ag-interpreter/analyze.js';
import { createBinderSpec } from '../ksc-behavior/binder.js';
import { createCheckerSpec } from '../ksc-behavior/checker.js';
import type { KindDefinition, CheckerDiagnostic, AttributeDepGraph } from '../ksc-behavior/types.js';

export interface EvaluationResult {
  definitions: KindDefinition[];
  diagnostics: CheckerDiagnostic[];
  getDepGraph(): AttributeDepGraph;
}

export function evaluate(root: KSNode): EvaluationResult {
  const grammar = createGrammar(getChildren);
  const semantics = createSemantics(grammar, [
    createBinderSpec(),
    createCheckerSpec(),
  ]);
  const results = interpret(semantics, root);

  const definitions = (results.get('ksc-binder') as KindDefinition[]) ?? [];
  const diagnostics = (results.get('ksc-checker') as CheckerDiagnostic[]) ?? [];

  let depGraph: AttributeDepGraph | undefined;
  function getDepGraph(): AttributeDepGraph {
    if (depGraph) return depGraph;
    const analysis = analyzeDeps(getChildren, semantics.compiled, root);

    const specOwnership: Record<string, string> = {};
    const declarations: Record<string, { direction: string }> = {};
    for (const spec of semantics.specs) {
      for (const [name] of spec.compiled) {
        specOwnership[name] = spec.name;
      }
    }
    for (const [name, decl] of semantics.declarations) {
      declarations[name] = { direction: decl.direction };
    }

    const edges: [string, string][] = [];
    for (const [attr, deps] of analysis.deps) {
      for (const dep of deps) {
        edges.push([attr, dep]);
      }
    }

    depGraph = {
      attributes: [...semantics.compiled.keys()],
      edges,
      order: analysis.order,
      specOwnership,
      declarations,
    };
    return depGraph;
  }

  return { definitions, diagnostics, getDepGraph };
}
```

#### `ksc-interpreter/index.ts`

Barrel + re-exports of AG primitives that `src/` needs (so `src/` never touches
`ag-*` directly):

```typescript
// KSC orchestration
export { evaluate } from './evaluate.js';
export type { EvaluationResult } from './evaluate.js';

// Re-exported AG primitives (so src/ never reaches into ag-interpreter/)
export { stampTree } from '../ag-interpreter/interpret.js';
export { serializeTree, deserializeTree } from '../ag-interpreter/serialize.js';
export type { SerializeOptions } from '../ag-interpreter/serialize.js';
```

## What changes in `src/`

### `src/program.ts`

Before (10 imports, inline AG orchestration):
```typescript
import type { KSProgramInterface, KindDefinition, CheckerDiagnostic, AttributeDepGraph } from './pipeline/types.js';
import { createBinderSpec } from './pipeline/binder.js';
import { createCheckerSpec } from './pipeline/checker.js';
import { createGrammar } from '../libs/ag/src/grammar.js';
import { createSemantics } from '../libs/ag/src/semantics.js';
import { interpret } from '../libs/ag/src/interpret.js';
import { analyzeDeps } from '../libs/ag/src/analyze.js';
// ... 48 lines of orchestration ...
```

After (2 imports, one function call):
```typescript
import { evaluate } from '../ksc-interpreter/index.js';
import type { KSProgramInterface } from './pipeline/types.js';
// ...
const ksTree = buildKSTree(tsProgram);
const { definitions, diagnostics, getDepGraph } = evaluate(ksTree.root);
```

`program.ts` drops from ~100 lines to ~40.

### `src/pipeline/types.ts`

Remove `KindDefinition`, `CheckerDiagnostic`, `AttributeDepGraph`. Keep only
`KSProgramInterface` (the app-level API). Re-export domain types from ksc-behavior:

```typescript
import type { KindDefinition, CheckerDiagnostic, AttributeDepGraph } from '../../ksc-behavior/index.js';
import type { KSCompilationUnit } from './ast.js';
import type { KSTree } from './convert.js';

export type { KindDefinition, CheckerDiagnostic, AttributeDepGraph };

export interface KSProgramInterface {
  getRootFileNames(): string[];
  getCompilationUnits(): KSCompilationUnit[];
  getKindDefinitions(): KindDefinition[];
  getDiagnostics(): CheckerDiagnostic[];
  getKSTree(): KSTree;
  getAttributeDepGraph(): AttributeDepGraph;
}
```

### `src/pipeline/serialize.ts`

Currently imports from `../../libs/ag/src/serialize.js`. Change to ksc-interpreter:

```typescript
import { serializeTree, deserializeTree, type SerializeOptions } from '../../ksc-interpreter/index.js';
```

### `src/index.ts`

Update import paths:
- `Kind`, `PropertySet` from `../ksc-behavior/index.js` (was `./api/kinds.js`)
- `KindDefinition`, `CheckerDiagnostic` from `../ksc-behavior/index.js` (was `./pipeline/types.js`)
- `createBinderSpec` from `../ksc-behavior/index.js` (was `./pipeline/binder.js`)
- `createCheckerSpec` from `../ksc-behavior/index.js` (was `./pipeline/checker.js`)
- `KSProgramInterface` stays from `./pipeline/types.js`

### Files deleted from `src/`

| File | Fate |
|------|------|
| `src/pipeline/binder.ts` | Moved to `ksc-behavior/binder.ts` |
| `src/pipeline/checker.ts` | Moved to `ksc-behavior/checker.ts` |
| `src/api/kinds.ts` | Merged into `ksc-behavior/types.ts` |

## What changes in `test/`

### `test/binder.test.ts`

Before (4 imports from 3 locations):
```typescript
import { createBinderSpec } from '../src/pipeline/binder.js';
import { createGrammar } from '../libs/ag/src/grammar.js';
import { createSemantics } from '../libs/ag/src/semantics.js';
import { interpret } from '../libs/ag/src/interpret.js';
```

After (from 2 modules):
```typescript
import { createBinderSpec } from '../ksc-behavior/index.js';
import { createGrammar, createSemantics, interpret } from '../ag-interpreter/index.js';
```

### `test/checker.test.ts`

Same pattern. Also update domain type imports:
```typescript
import { createBinderSpec, createCheckerSpec } from '../ksc-behavior/index.js';
import type { KindDefinition, CheckerDiagnostic } from '../ksc-behavior/index.js';
import { createGrammar, createSemantics, interpret } from '../ag-interpreter/index.js';
```

### `test/grammar.test.ts`

Currently has the most `libs/ag` imports (6). After:
```typescript
import { createBinderSpec, createCheckerSpec } from '../ksc-behavior/index.js';
import type { KindDefinition, CheckerDiagnostic } from '../ksc-behavior/index.js';
import { createGrammar, createSemantics, interpret, compile, analyzeDeps } from '../ag-interpreter/index.js';
import type { SpecInput } from '../ag-behavior/index.js';
```

### `test/convert.test.ts`

```typescript
// Was: import { stampTree } from '../libs/ag/src/interpret.js';
import { stampTree } from '../ksc-interpreter/index.js';
```

## What gets deleted

| Path | Fate |
|------|------|
| `libs/ag/src/spec.ts` | Moved to `ag-behavior/spec.ts` |
| `libs/ag/src/compile.ts` | Moved to `ag-interpreter/compile.ts` |
| `libs/ag/src/grammar.ts` | Moved to `ag-interpreter/grammar.ts` |
| `libs/ag/src/semantics.ts` | Moved to `ag-interpreter/semantics.ts` |
| `libs/ag/src/interpret.ts` | Moved to `ag-interpreter/interpret.ts` |
| `libs/ag/src/analyze.ts` | Moved to `ag-interpreter/analyze.ts` |
| `libs/ag/src/serialize.ts` | Moved to `ag-interpreter/serialize.ts` |
| `libs/ag/src/index.ts` | Replaced by `ag-behavior/index.ts` + `ag-interpreter/index.ts` |
| `libs/ag/tsconfig.json` | Deleted — modules use root tsconfig |
| `libs/ag/` directory | Deleted entirely |
| `src/pipeline/binder.ts` | Moved to `ksc-behavior/binder.ts` |
| `src/pipeline/checker.ts` | Moved to `ksc-behavior/checker.ts` |
| `src/api/kinds.ts` | Merged into `ksc-behavior/types.ts` |

## What does NOT change

- `ast-schema/` — untouched
- `src/pipeline/ast.ts` — untouched
- `src/pipeline/convert.ts` — untouched
- `src/pipeline/parse.ts` — untouched (uses convert, no AG)
- `src/api/config.ts` — untouched

## `tsconfig.json`

Before:
```json
"include": ["src", "ast-schema/generated"],
"references": [{ "path": "libs/ag" }]
```

After:
```json
"include": ["src", "ast-schema/generated", "ag-behavior", "ag-interpreter", "ksc-behavior", "ksc-interpreter"]
```

Remove the `"references"` field entirely — no more composite project references.

## Steps

### Step 1: Create `ag-behavior/` ✅

1. Create `ag-behavior/spec.ts` — copy from `libs/ag/src/spec.ts` (no changes) ✅
2. Create `ag-behavior/index.ts` — barrel ✅

### Step 2: Create `ag-interpreter/` ✅

1. Create `ag-interpreter/compile.ts` — copy from `libs/ag/src/compile.ts`, update spec.ts import path ✅
2. Create `ag-interpreter/grammar.ts` — copy from `libs/ag/src/grammar.ts` (no changes) ✅
3. Create `ag-interpreter/semantics.ts` — copy from `libs/ag/src/semantics.ts`, update spec.ts import path ✅
4. Create `ag-interpreter/interpret.ts` — copy from `libs/ag/src/interpret.ts` (no changes — only local imports) ✅
5. Create `ag-interpreter/analyze.ts` — copy from `libs/ag/src/analyze.ts` (no changes — only local imports) ✅
6. Create `ag-interpreter/serialize.ts` — copy from `libs/ag/src/serialize.ts` (no changes — only local imports) ✅
7. Create `ag-interpreter/index.ts` — barrel ✅

### Step 3: Create `ksc-behavior/` ✅

1. Create `ksc-behavior/types.ts` — merge `src/api/kinds.ts` + AG domain types from `src/pipeline/types.ts` ✅
2. Create `ksc-behavior/binder.ts` — move from `src/pipeline/binder.ts`, update imports ✅
3. Create `ksc-behavior/checker.ts` — move from `src/pipeline/checker.ts`, update imports ✅
4. Create `ksc-behavior/index.ts` — barrel ✅

### Step 4: Create `ksc-interpreter/` ✅

1. Create `ksc-interpreter/evaluate.ts` — extract AG orchestration from `src/program.ts` ✅
2. Create `ksc-interpreter/index.ts` — barrel + AG primitive re-exports ✅

### Step 5: Update `src/` ✅

1. Update `src/program.ts` — use `evaluate()` from ksc-interpreter, remove all libs/ag + pipeline/binder/checker imports ✅
2. Update `src/pipeline/types.ts` — remove moved types, re-export from ksc-behavior, keep `KSProgramInterface` ✅
3. Update `src/pipeline/serialize.ts` — import from ksc-interpreter ✅
4. Update `src/index.ts` — import specs and types from ksc-behavior ✅
5. Delete `src/pipeline/binder.ts`, `src/pipeline/checker.ts`, `src/api/kinds.ts` ✅

### Step 6: Update `test/` ✅

1. Update `test/binder.test.ts` — specs from ksc-behavior, AG primitives from ag-interpreter ✅
2. Update `test/checker.test.ts` — specs + types from ksc-behavior, AG primitives from ag-interpreter ✅
3. Update `test/grammar.test.ts` — SpecInput from ag-behavior, AG primitives from ag-interpreter, specs + types from ksc-behavior ✅
4. Update `test/convert.test.ts` — stampTree from ksc-interpreter ✅

### Step 7: Update `tsconfig.json` ✅

Add new modules to `include`, remove `references` to `libs/ag`. ✅

### Step 8: Delete `libs/ag/` ✅

Remove the entire `libs/ag/` directory. ✅

### Step 9: Run tests ✅

All 131 tests pass. All verification grep checks return zero matches. ✅

## Resulting dependency graph

```
ast-schema/              ag-behavior/
(data — AST types,       (generic AG vocabulary —
 getChildren)             SpecInput, AttrDecl)
    |                         |
    |    ┌────────────────────┤
    |    |                    |
    |    ▼                    ▼
    |  ag-interpreter/      ksc-behavior/
    |  (generic AG engine — (KSC specs + domain types —
    |   compile, grammar,    binder, checker,
    |   semantics,           KindDefinition, etc.)
    |   interpret, analyze)
    |    |                    |
    |    |    ┌───────────────┘
    |    |    |
    |    ▼    ▼
    |  ksc-interpreter/
    |  (KSC orchestration —
    |   evaluate(), re-exports
    |   AG primitives for src/)
    |    |
    ├────┘
    |
    ▼
  src/
  (app — program creation,
   public API surface)
```

Every arrow points downward. `src/` never touches `ag-behavior/` or `ag-interpreter/`.
All generic AG access flows through `ksc-interpreter/`. All behavior definitions flow
through `ksc-behavior/`.

## Verification

After implementation, confirm:
- `grep -r 'libs/ag' src/ test/` returns zero matches
- `grep -r 'ag-behavior' src/` returns zero matches
- `grep -r 'ag-interpreter' src/` returns zero matches
- `grep -r 'pipeline/binder' src/ test/` returns zero matches
- `grep -r 'pipeline/checker' src/ test/` returns zero matches
- `grep -r 'api/kinds' src/` returns zero matches
- All tests pass
