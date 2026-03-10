# KSC Directory Restructure Plan

## Overview

Restructure the KSC repository from 7 source directories with inconsistent naming, scattered generated output, and mixed concerns into 5 clearly delineated directories where each directory maps to exactly one architectural concern.

## Problems With Current Structure

```
ksc/
├── ast-schema/          # Mixes: DSL infrastructure + node registrations +
│   ├── builder.ts       #   codegen wrapper script + generated output + export utility
│   ├── schema.ts        #   Five different concerns in one directory
│   ├── codegen.ts       #   codegen.ts is a script but doesn't live in scripts/
│   ├── export.ts
│   ├── verify.ts
│   └── generated/       #   Generated output #1
├── ksc-compiler/        # Redundant ksc- prefix
├── ksc-analysis/        # One file in its own directory
│   └── spec.ts
├── ksc-behavior/        # Grab-bag: domain types + AG interface + equations +
│   ├── types.ts         #   a generated file + barrel export
│   ├── ctx.ts           #   "behavior" communicates nothing
│   ├── binder.ts
│   ├── attr-types.ts    #   Generated output #2 (mixed with hand-written code)
│   └── index.ts
├── ksc-generated/       # Generated output #3
│   └── evaluator.ts
├── src/                 # "src" implies everything else isn't source
│   ├── index.ts
│   ├── program.ts
│   ├── api/config.ts
│   ├── cli/cli.ts
│   └── pipeline/
├── scripts/
│   ├── gen-ksc-evaluator.ts
│   └── compile-all.ts
```

**Problem 1: Generated output scattered across three locations.** `ast-schema/generated/`, `ksc-generated/evaluator.ts`, and `ksc-behavior/attr-types.ts` are all machine-generated but live in different places. A developer cannot answer "what is auto-generated?" without memorizing the layout. `attr-types.ts` gives no signal at all that it's generated.

**Problem 2: `ksc-behavior/` is a grab-bag with a meaningless name.** Contains domain types (`PropertySet`, `KindDefinition`), an AG framework interface (`Ctx`), equation implementations (`binder.ts`), a generated file (`attr-types.ts`), and a barrel re-export (`index.ts`). "Behavior" describes none of these.

**Problem 3: `ast-schema/` mixes five concerns.** Builder DSL infrastructure, node registrations, a codegen wrapper script, a verification script, a dashboard export utility, and generated output all in one folder.

**Problem 4: `ksc-` prefix adds noise.** Every directory is already under `ksc/`. The prefix is redundant and applied inconsistently (`ast-schema` and `src` don't use it).

**Problem 5: Codegen scripts are split.** `ast-schema/codegen.ts` is a codegen wrapper but lives alongside source code. `scripts/gen-ksc-evaluator.ts` and `scripts/compile-all.ts` are in `scripts/`. The grammar verification script (`ast-schema/verify.ts`) is also misplaced.

**Problem 6: `ksc-analysis/` exists for one file.** The analysis spec is the natural companion to the binder equations and domain types, but they're separated into different directories.

**Problem 7: `src/` is a misleading name.** Implies "this is the source code and everything else isn't." It's actually the application/consumer layer.

## Target Structure

```
ksc/
├── grammar/                        # AST structure definition
│   ├── builder.ts                  #   DSL: node(), sumType(), child(), prop()
│   ├── nodes.ts                    #   All node/sumType registrations
│   └── export.ts                   #   AST data export for dashboard
│
├── analysis/                       # Analysis specification + domain
│   ├── spec.ts                     #   AnalysisSpec: properties + structural attrs
│   ├── binder.ts                   #   Binder equation functions
│   ├── ctx.ts                      #   Ctx interface (equation contract)
│   ├── types.ts                    #   PropertySet, Kind<>, KindDefinition,
│   │                               #   CheckerDiagnostic, DefIdCounter, PROPERTY_KEYS
│   └── index.ts                    #   Barrel re-export (public API surface)
│
├── compiler/                       # Pure compilation functors
│   ├── grammar.ts                  #   Functor 1: compileGrammar
│   ├── analysis.ts                 #   Functor 2: compileAnalysis
│   ├── validate.ts                 #   Cross-functor validation
│   ├── violation.ts                #   Type-safe violation builder
│   ├── types.ts                    #   GrammarSpec, AnalysisSpec, AttributeDepGraph, etc.
│   └── pipeline.ts                 #   Barrel re-export
│
├── generated/                      # ALL machine-generated output
│   ├── ast/                        #   Functor 1: node-types, schema, convert,
│   │   ├── node-types.ts           #     builders, serialize, kind-map, index
│   │   ├── schema.ts
│   │   ├── convert.ts
│   │   ├── builders.ts
│   │   ├── serialize.ts
│   │   ├── kind-map.ts
│   │   └── index.ts
│   ├── evaluator.ts                #   Functor 2: compiled KSCDNode evaluator
│   └── attr-types.ts               #   Functor 2: KSCAttrMap interface
│
├── app/                            # Application layer
│   ├── index.ts                    #   Public API (re-exports from analysis/, generated/)
│   ├── program.ts                  #   Program coordinator
│   ├── config.ts                   #   KindScriptConfig + defineConfig
│   ├── cli.ts                      #   CLI entry point
│   └── pipeline/
│       ├── parse.ts                #   Parse-only path
│       └── types.ts                #   KSProgramInterface
│
├── scripts/                        # ALL build/codegen orchestration
│   ├── codegen-grammar.ts          #   Runs Functor 1 (was ast-schema/codegen.ts)
│   ├── codegen-analysis.ts         #   Runs Functor 2 (was scripts/gen-ksc-evaluator.ts)
│   ├── codegen-all.ts              #   Both + cross-validation (was scripts/compile-all.ts)
│   └── verify-grammar.ts           #   Schema verification (was ast-schema/verify.ts)
│
├── test/
├── docs/
├── dashboard/
└── examples/
```

## File Mapping

Every current file mapped to its new location.

### ast-schema/ → grammar/ + generated/ast/ + scripts/

| Current | New | Notes |
|---------|-----|-------|
| `ast-schema/builder.ts` | `grammar/builder.ts` | Unchanged content |
| `ast-schema/schema.ts` | `grammar/nodes.ts` | Rename: "nodes" is more precise inside `grammar/` |
| `ast-schema/export.ts` | `grammar/export.ts` | Unchanged content, update imports |
| `ast-schema/codegen.ts` | `scripts/codegen-grammar.ts` | It's a script, not source |
| `ast-schema/verify.ts` | `scripts/verify-grammar.ts` | It's a script, not source |
| `ast-schema/generated/*.ts` | `generated/ast/*.ts` | All 7 files move as-is |

### ksc-behavior/ → analysis/

| Current | New | Notes |
|---------|-----|-------|
| `ksc-behavior/types.ts` | `analysis/types.ts` | Update imports |
| `ksc-behavior/ctx.ts` | `analysis/ctx.ts` | Update imports |
| `ksc-behavior/binder.ts` | `analysis/binder.ts` | Update imports |
| `ksc-behavior/index.ts` | `analysis/index.ts` | Update re-export paths |
| `ksc-behavior/attr-types.ts` | `generated/attr-types.ts` | It's generated output |

### ksc-analysis/ → analysis/

| Current | New | Notes |
|---------|-----|-------|
| `ksc-analysis/spec.ts` | `analysis/spec.ts` | Merges into analysis/ alongside types, ctx, binder |

### ksc-compiler/ → compiler/

| Current | New | Notes |
|---------|-----|-------|
| `ksc-compiler/compile-grammar.ts` | `compiler/grammar.ts` | Drop redundant `compile-` prefix |
| `ksc-compiler/compile-analysis.ts` | `compiler/analysis.ts` | Drop redundant `compile-` prefix |
| `ksc-compiler/types.ts` | `compiler/types.ts` | Add `AttributeDepGraph` (moved from ksc-behavior/types.ts) |
| `ksc-compiler/validate.ts` | `compiler/validate.ts` | Unchanged |
| `ksc-compiler/violation.ts` | `compiler/violation.ts` | Update imports |
| `ksc-compiler/pipeline.ts` | `compiler/pipeline.ts` | Update re-export paths |

### ksc-generated/ → generated/

| Current | New | Notes |
|---------|-----|-------|
| `ksc-generated/evaluator.ts` | `generated/evaluator.ts` | Generated, update imports in codegen |

### src/ → app/

| Current | New | Notes |
|---------|-----|-------|
| `src/index.ts` | `app/index.ts` | Update import paths |
| `src/program.ts` | `app/program.ts` | Update import paths |
| `src/api/config.ts` | `app/config.ts` | Flatten: no need for `api/` subdirectory |
| `src/cli/cli.ts` | `app/cli.ts` | Flatten: no need for `cli/` subdirectory |
| `src/pipeline/parse.ts` | `app/pipeline/parse.ts` | Update import paths |
| `src/pipeline/types.ts` | `app/pipeline/types.ts` | Update import paths |

### scripts/

| Current | New | Notes |
|---------|-----|-------|
| `scripts/gen-ksc-evaluator.ts` | `scripts/codegen-analysis.ts` | Rename for consistency |
| `scripts/compile-all.ts` | `scripts/codegen-all.ts` | Rename for consistency |
| `scripts/_ts-checker-probe.ts` | `scripts/_ts-checker-probe.ts` | Unchanged |
| `scripts/_binder-fields-probe.ts` | `scripts/_binder-fields-probe.ts` | Unchanged |

## Type Placement Rationale

Every type currently in `ksc-behavior/types.ts` and where it goes:

### → analysis/types.ts

**`PropertySet`** — Defines the vocabulary of checkable properties (`noImports`, `noConsole`, etc.). Used by the analysis spec (annotationKey values), the binder (extracts from source), and the public API. It defines *what the analysis checks for*, making it an analysis concern. Although users write `Kind<{ noImports: true }>` in source code, PropertySet defines the analytical semantics, not AST structure.

**`Kind<R>`** — Phantom type: `{ readonly __kind?: R }`. Paired with PropertySet. Users write `type NoImports = Kind<{ noImports: true }>`. It's the type-level bridge between user code and the analysis. Stays with PropertySet.

**`KindDefinition`** — What the binder discovers from `type X = Kind<{...}>` declarations. Fields: id, name, properties (PropertySet), node (KSTypeAliasDeclaration). Produced by binder equations, consumed by violation rules for context propagation, returned to the app as results. Analysis output type.

**`CheckerDiagnostic`** — What violation rules produce. Fields: node, message, kindName, property, pos, end, fileName. Produced by the generated evaluator, collected by allViolations, returned to the app. Analysis output type.

**`DefIdCounter`** — `{ value: number }`. Mutable counter used by binder equations to generate unique definition IDs. Implementation detail of the binder, only used by `binder.ts` and the generated evaluator.

**`PROPERTY_KEYS`** — `Set<keyof PropertySet>`. Derived from PropertySet, used only by `binder.ts` to validate property names during extraction. Binder implementation detail.

### → compiler/types.ts

**`AttributeDepGraph`** — `{ attributes, edges, order, specOwnership, declarations }`. Built by `compileAnalysis`, embedded in the generated evaluator as a static constant, returned to the app for visualization. This is compiler output metadata — it describes what the compiler produced. The compiler builds it and the generated code embeds it.

### → generated/attr-types.ts (already generated)

**`KSCAttrMap`** — Generated interface mapping attribute names to their types. Only consumed by `Ctx.attr()`. Already generated by `compileAnalysis`, just needs to move to `generated/`.

### analysis/ctx.ts (unchanged)

**`Ctx`** — `{ node, parent, children, isRoot, attr(), parentIs() }`. The AG framework interface that all equation functions are written against. The generated evaluator (KSCDNode) implements it. It belongs with analysis because equation authors are the primary consumers: they program against `Ctx`, and the shape of `Ctx` is determined by what the analysis needs.

## Import Path Changes

The generated evaluator currently imports from 5 directories. After restructuring:

```typescript
// Current evaluator imports:
import { KSNode } from '../ast-schema/generated/index.js';
import { KSCAttrMap } from '../ksc-behavior/attr-types.js';
import { Ctx } from '../ksc-behavior/ctx.js';
import { KindDefinition, ... } from '../ksc-behavior/types.js';
import { DefIdCounter, ... } from '../ksc-behavior/binder.js';
import { analysisSpec } from '../ksc-analysis/spec.js';
import { ViolationRule } from '../ksc-compiler/types.js';

// New evaluator imports:
import { KSNode } from './ast/index.js';            // generated/ → generated/ast/
import { KSCAttrMap } from './attr-types.js';        // generated/ → generated/
import { Ctx } from '../analysis/ctx.js';            // analysis/
import { KindDefinition, ... } from '../analysis/types.js';  // analysis/
import { DefIdCounter, ... } from '../analysis/binder.js';   // analysis/
import { analysisSpec } from '../analysis/spec.js';           // analysis/
import { ViolationRule } from '../compiler/types.js';         // compiler/
```

The evaluator's imports simplify from 5 directories to 3 (`generated/` internal, `analysis/`, `compiler/`).

All import path updates must be made in two places:
1. **Source files** — hand-written imports (grep and replace)
2. **Codegen templates** — the string literals inside `compiler/grammar.ts` and `compiler/analysis.ts` that produce import statements in generated code

### Codegen Template Updates

In `compiler/analysis.ts` (currently `ksc-compiler/compile-analysis.ts`), the `generateEvaluator()` function emits import statements as string literals. These must be updated:

```typescript
// Current (in generateEvaluator):
L.push(`import type { KSNode } from '../ast-schema/generated/index.js';`);
L.push(`import { getChildFields } from '../ast-schema/generated/index.js';`);
L.push(`import type { KSCAttrMap } from '../ksc-behavior/attr-types.js';`);
L.push(`import type { Ctx } from '../ksc-behavior/ctx.js';`);
// ...

// New:
L.push(`import type { KSNode } from './ast/index.js';`);
L.push(`import { getChildFields } from './ast/index.js';`);
L.push(`import type { KSCAttrMap } from './attr-types.js';`);
L.push(`import type { Ctx } from '../analysis/ctx.js';`);
// ...
```

Similarly, `compiler/grammar.ts` (currently `ksc-compiler/compile-grammar.ts`) emits import paths in the generated `convert.ts`, `builders.ts`, etc. These don't need changes because they're all relative within `generated/ast/`.

### App Public API Updates

`app/index.ts` (currently `src/index.ts`) re-exports from:

```typescript
// Current:
export type { Kind, PropertySet } from '../ksc-behavior/index.js';
export type { KindDefinition, CheckerDiagnostic } from '../ksc-behavior/index.js';
export { extractASTData } from '../ast-schema/export.js';

// New:
export type { Kind, PropertySet } from '../analysis/index.js';
export type { KindDefinition, CheckerDiagnostic } from '../analysis/index.js';
export { extractASTData } from '../grammar/export.js';
```

## Dependency Graph After Restructure

```
grammar/
  depends on: generated/ast/ (export.ts uses generated AST types)
  used by:    compiler/ (builder.ts types), scripts/, app/

analysis/
  depends on: generated/ast/ (types.ts references KSNode, KSTypeAliasDeclaration)
              generated/attr-types.ts (ctx.ts references KSCAttrMap)
              compiler/types.ts (spec.ts uses AnalysisSpec, ViolationRule)
  used by:    generated/evaluator.ts, compiler/, app/

compiler/
  depends on: analysis/types.ts (KindDefinition, CheckerDiagnostic in spec types)
              analysis/ctx.ts (Ctx in EquationFn)
              grammar/builder.ts (NodeEntry, SumTypeEntry in GrammarSpec)
              generated/ast/ (KSNode, KindToNode in violation.ts)
  used by:    analysis/spec.ts, scripts/

generated/
  depends on: analysis/ (evaluator imports spec, binder, ctx, types)
              compiler/ (evaluator imports ViolationRule)
  used by:    analysis/types.ts, analysis/ctx.ts, app/, grammar/export.ts

app/
  depends on: generated/ (evaluator, convert)
              analysis/ (types via index.ts)
              grammar/ (export.ts)
  used by:    (end users)
```

Note: there is a type-only circular dependency between `analysis/` and `generated/`. `analysis/types.ts` imports `KSTypeAliasDeclaration` from `generated/ast/`, and `generated/evaluator.ts` imports from `analysis/`. This is inherent — domain types reference AST node types, and the generated evaluator uses domain types. It works fine because the cross-boundary imports are type-only (erased at runtime). Making this dependency explicit in the folder structure is better than hiding it by co-locating generated and hand-written files.

## Execution Order

The restructure itself is mechanical. Recommended order to minimize broken intermediate states:

### Phase 1: Create target directories

```bash
mkdir -p grammar analysis compiler generated/ast app/pipeline
```

### Phase 2: Move and rename files (no content changes yet)

Move files in dependency order (leaves first):

```bash
# grammar/
cp ast-schema/builder.ts grammar/builder.ts
cp ast-schema/schema.ts grammar/nodes.ts
cp ast-schema/export.ts grammar/export.ts

# analysis/
cp ksc-behavior/types.ts analysis/types.ts
cp ksc-behavior/ctx.ts analysis/ctx.ts
cp ksc-behavior/binder.ts analysis/binder.ts
cp ksc-behavior/index.ts analysis/index.ts
cp ksc-analysis/spec.ts analysis/spec.ts

# compiler/
cp ksc-compiler/compile-grammar.ts compiler/grammar.ts
cp ksc-compiler/compile-analysis.ts compiler/analysis.ts
cp ksc-compiler/types.ts compiler/types.ts
cp ksc-compiler/validate.ts compiler/validate.ts
cp ksc-compiler/violation.ts compiler/violation.ts
cp ksc-compiler/pipeline.ts compiler/pipeline.ts

# generated/
cp ast-schema/generated/*.ts generated/ast/
cp ksc-behavior/attr-types.ts generated/attr-types.ts
cp ksc-generated/evaluator.ts generated/evaluator.ts

# app/
cp src/index.ts app/index.ts
cp src/program.ts app/program.ts
cp src/api/config.ts app/config.ts
cp src/cli/cli.ts app/cli.ts
cp src/pipeline/parse.ts app/pipeline/parse.ts
cp src/pipeline/types.ts app/pipeline/types.ts

# scripts/
cp ast-schema/codegen.ts scripts/codegen-grammar.ts
cp ast-schema/verify.ts scripts/verify-grammar.ts
mv scripts/gen-ksc-evaluator.ts scripts/codegen-analysis.ts
mv scripts/compile-all.ts scripts/codegen-all.ts
```

### Phase 3: Update all import paths

Every file that imports across directories needs path updates. The full list:

**analysis/types.ts** — `../ast-schema/generated/index.js` → `../generated/ast/index.js`

**analysis/ctx.ts** — `../ast-schema/generated/index.js` → `../generated/ast/index.js`, `./attr-types.js` → `../generated/attr-types.js`

**analysis/binder.ts** — `../ast-schema/generated/index.js` → `../generated/ast/index.js`

**analysis/spec.ts** — `../ksc-compiler/types.js` → `../compiler/types.js`, `../ksc-behavior/ctx.js` → `./ctx.js`, `../ksc-behavior/types.js` → `./types.js`, `../ast-schema/generated/index.js` → `../generated/ast/index.js`, `../ksc-compiler/violation.js` → `../compiler/violation.js`, `../ksc-behavior/binder.js` → `./binder.js`

**analysis/index.ts** — all `./` paths stay the same (internal re-exports)

**compiler/grammar.ts** — `./types.js` stays, `../ast-schema/builder.js` → `../grammar/builder.js`

**compiler/analysis.ts** — `../ksc-behavior/types.js` → `../analysis/types.js`

**compiler/types.ts** — `../ksc-behavior/ctx.js` → `../analysis/ctx.js`, `../ast-schema/generated/index.js` → `../generated/ast/index.js`, `../ksc-behavior/types.js` → `../analysis/types.js`, `../ast-schema/builder.js` → `../grammar/builder.js`

**compiler/violation.ts** — `../ast-schema/generated/kind-map.js` → `../generated/ast/kind-map.js`, `../ksc-behavior/ctx.js` → `../analysis/ctx.js`, `../ksc-behavior/types.js` → `../analysis/types.js`

**compiler/validate.ts** — internal imports only (unchanged)

**grammar/export.ts** — `./generated/convert.js` → `../generated/ast/convert.js`, `./generated/node-types.js` → `../generated/ast/node-types.js`, `./generated/schema.js` → `../generated/ast/schema.js`

**grammar/nodes.ts** — `./builder.js` stays (internal)

**app/index.ts** — `../ksc-behavior/index.js` → `../analysis/index.js`, `../ast-schema/export.js` → `../grammar/export.js`

**app/program.ts** — `../ast-schema/generated/convert.js` → `../generated/ast/convert.js`, `../ksc-generated/evaluator.js` → `../generated/evaluator.js`, `./api/config.js` → `./config.js`, `./pipeline/types.js` stays

**app/config.ts** — no cross-directory imports

**app/cli.ts** — `../program.js` → `./program.js`, `../api/config.js` → `./config.js`

**app/pipeline/parse.ts** — `../../ast-schema/generated/convert.js` → `../../generated/ast/convert.js`

**app/pipeline/types.ts** — `../../ksc-behavior/index.js` → `../../analysis/index.js`, `../../ast-schema/generated/index.js` → `../../generated/ast/index.js`, `../../ast-schema/generated/convert.js` → `../../generated/ast/convert.js`

**scripts/codegen-grammar.ts** — `./schema.js` → `../grammar/nodes.js`, `./builder.js` → `../grammar/builder.js`, `../ksc-compiler/compile-grammar.js` → `../compiler/grammar.js`, `../ksc-compiler/types.js` → `../compiler/types.js`. Output path: `generated/ast/`

**scripts/codegen-analysis.ts** — `../ksc-analysis/spec.js` → `../analysis/spec.js`, `../ksc-compiler/compile-analysis.js` → `../compiler/analysis.js`. Output paths: `generated/evaluator.ts`, `analysis/` → no, attr-types goes to `generated/attr-types.ts`

**scripts/codegen-all.ts** — combine changes from both codegen scripts above, plus `../ksc-compiler/validate.js` → `../compiler/validate.js`

**scripts/verify-grammar.ts** — `./schema.js` → `../grammar/nodes.js`, `./builder.js` → `../grammar/builder.js`

### Phase 4: Update codegen templates

String literals in `compiler/grammar.ts` and `compiler/analysis.ts` that emit import statements in generated code.

**compiler/analysis.ts** (`generateEvaluator` function) — update all emitted import paths:
- `'../ast-schema/generated/index.js'` → `'./ast/index.js'`
- `'../ksc-behavior/attr-types.js'` → `'./attr-types.js'`
- `'../ksc-behavior/ctx.js'` → `'../analysis/ctx.js'`
- `'../ksc-behavior/types.js'` → `'../analysis/types.js'`
- `'../ksc-behavior/binder.js'` → `'../analysis/binder.js'`
- `'../ksc-analysis/spec.js'` → `'../analysis/spec.js'`
- `'../ksc-compiler/types.js'` → `'../compiler/types.js'`

**compiler/grammar.ts** — the generated files in `generated/ast/` import from each other with relative paths (`./node-types.js`, `./schema.js`, etc.) which remain valid. No changes needed in grammar codegen templates.

### Phase 5: Move AttributeDepGraph to compiler/types.ts

Remove `AttributeDepGraph` from `analysis/types.ts` and add it to `compiler/types.ts`. Update all imports that reference it:
- `compiler/analysis.ts` — already imports from `./types.js`
- `generated/evaluator.ts` — update codegen template: `'../ksc-behavior/types.js'` → `'../compiler/types.js'` for `AttributeDepGraph`
- `app/pipeline/types.ts` — import from `../../compiler/types.js` instead of `../../analysis/index.js`

### Phase 6: Update test imports

All test files import from the old paths. Each test file needs its imports updated:
- `../ast-schema/generated/` → `../generated/ast/`
- `../ksc-generated/evaluator.js` → `../generated/evaluator.js`
- `../ksc-behavior/types.js` → `../analysis/types.js`
- `../ksc-compiler/` → `../compiler/`
- `../ksc-analysis/` → `../analysis/`

### Phase 7: Update tsconfig, package.json, examples, docs

- `tsconfig.json` — update `include` paths if specified
- `package.json` — update `main`/`exports` if they reference `src/`
- `examples/*.ts` — update imports from `../ast-schema/` → `../grammar/`, etc.
- `docs/**/*.md` — update code examples and file references
- `dashboard/` — update any imports from old paths

### Phase 8: Regenerate and verify

```bash
npx tsx scripts/codegen-all.ts    # regenerate with new paths
npx tsc --noEmit                  # type check
npx vitest run --testTimeout=30000  # all tests pass
```

### Phase 9: Remove old directories

```bash
rm -rf ast-schema ksc-analysis ksc-behavior ksc-compiler ksc-generated src
```

## Naming Decisions

| Name | Why this, not alternatives |
|------|--------------------------|
| `grammar/` | Standard term for AST structure definitions. Not `ast-schema/` (was also the output format name), not `lang/` (too broad), not `schema/` (ambiguous with database schemas). |
| `analysis/` | Covers the spec, equations, and domain types. Not `rules/` (binder equations aren't rules), not `spec/` (conflicts with `spec.ts`), not `behavior/` (meaningless). |
| `compiler/` | Standard for "transforms specification into executable code." Not `codegen/` (describes what it does, not what it is), not `functors/` (too academic). |
| `generated/` | Self-documenting. Not `output/` (ambiguous with build output), not `dist/` (conventional for JS bundles). |
| `app/` | Identifies it as the application/consumer layer. Not `src/` (implies everything else isn't source). |
| `grammar/nodes.ts` | Inside `grammar/`, "nodes" is more precise than "schema" (which was the old directory name). |
| `compiler/grammar.ts` | Drop the `compile-` prefix; inside `compiler/`, it's obvious this compiles. |
| `compiler/analysis.ts` | Same reasoning. |
| `scripts/codegen-*.ts` | Consistent `codegen-` prefix for all codegen scripts. |

## Verification Checklist

**Status: COMPLETED** (2026-03-08)

All phases executed successfully:

- [x] `npx tsc --noEmit` — zero type errors
- [x] `npx vitest run --testTimeout=30000` — all 208 tests pass
- [x] `npx tsx scripts/codegen-all.ts` — both functors run, cross-validation passes
- [x] `npx tsx scripts/codegen-grammar.ts` — grammar codegen works standalone
- [x] `npx tsx scripts/codegen-analysis.ts` — analysis codegen works standalone
- [x] No files remain in old directories (`ast-schema/`, `ksc-*/`, `src/`)
- [x] Generated output only exists under `generated/`
- [x] All import paths updated (source, codegen templates, tests, examples, docs)
- [x] AUTO-GENERATED comments in codegen templates updated to new paths
- [x] tsconfig.json include paths updated
- [x] package.json main/types/bin entries updated
- [x] Tutorial doc updated with new paths and commands
