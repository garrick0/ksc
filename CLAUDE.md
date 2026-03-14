# KindScript — Developer Guide

## Architecture Overview

KindScript is a **declarative attribute grammar system** organized into
**bounded contexts** under a single `libs/` root. Each bounded context
follows **strict clean architecture**: `domain/` (ports, contracts, core engine),
`application/` (use cases, orchestration), `adapters/` (implementations of ports).
No files live directly under `libs/<context>/` except `index.ts` (barrel).

All source code lives under `libs/` and `apps/`:

- **`libs/grammar/`** — grammar bounded context (leaf module, no deps on codegen/evaluation)
  - `domain/` — ports (`Grammar<K>`, `ASTNode`, `AstTranslatorPort`), base types, schema shapes
  - `application/` — metadata computation, tree ops, serialization, parse-only pipeline
  - `adapters/` — grammar implementations (ts-ast, mock), translators (ts-ast), extraction (ts-ast)
- **`libs/behavior/`** — codegen bounded context
  - `domain/` — ports (`AnalysisDecl<K>`, `CodegenTarget<K>`), types
  - `application/` — compilation pipeline, validation, equation utilities
  - `adapters/` — analysis authoring (specs, equations, types, generated output)
- **`libs/evaluation/`** — evaluation bounded context (lean, generic executor)
  - `domain/` — engine, ports (`DispatchConfig`, `EvaluationTarget`, `Evaluator`, `Ctx`)
  - `application/` — use cases (check-program, check-project, config, find-files)
  - `adapters/` — runtime projections + pre-wired targets (no grammar/analysis authoring)

`apps/` (runnable shells) delegate to the evaluation/codegen layers.
npm `package.json` exports point directly at `libs/` — no shim layer.

**Boundary enforcement** via ESLint `no-restricted-imports` (see `eslint.config.js`):
- `codegen/domain+application/` cannot import from `evaluation/`
- `codegen/adapters/` can import `evaluation/domain/` (Ctx, KindCtx for equations)
- `evaluation/domain/` cannot import from `codegen/`
- `evaluation/adapters/` can import `codegen/adapters/.../generated/` and `.../types.ts`
- `grammar/` is a leaf — no deps on codegen or evaluation

## Ports and Implementations

```
PORTS (contracts)
├── Grammar<K>                  libs/grammar/domain/ports.ts          — what a grammar provides
├── AstTranslatorPort<I, R, O>  libs/grammar/domain/ports.ts          — what a converter provides
├── AnalysisDecl<K>             libs/behavior/domain/ports.ts           — what an analysis declares (codegen-time)
├── CodegenTarget<K>            libs/behavior/domain/types.ts           — what a codegen root provides
├── DispatchConfig              libs/evaluation/domain/ports.ts        — what generated dispatch provides
├── Ctx / KindCtx<N>            libs/evaluation/domain/ctx.ts          — how equations access the tree
├── AnalysisProjections<M, P>   libs/evaluation/domain/analysis-ports.ts — what an analysis provides at runtime
├── EvaluationTarget<K, M, P>   libs/evaluation/domain/ports.ts        — what a fully-assembled analysis provides at runtime
├── Evaluator<M, P>             libs/evaluation/domain/engine.ts        — evaluator interface (evaluate + buildTree)
└── TypedAGNode<M>              libs/evaluation/domain/ports.ts         — type-safe attribute access

IMPLEMENTATIONS (adapters — organized by bounded context)
├── libs/grammar/adapters/grammars/ts-ast/           → Grammar<TSNodeKind>
├── libs/grammar/adapters/grammars/mock/             → Grammar<MockKind>
├── libs/grammar/adapters/translators/ts-ast/        → AstTranslatorPort<ts.Program, KSProgram, AnalysisDepth>
├── libs/grammar/adapters/extraction/ts-ast/         → extractASTData (TS-specific tree serialization)
├── libs/behavior/adapters/analyses/ts-kind-checking/ → AnalysisDecl + equations + generated output
├── libs/behavior/adapters/analyses/eslint-equiv/     → AnalysisDecl + equations + generated output
├── libs/behavior/adapters/analyses/mock/             → AnalysisDecl + generated output
├── libs/evaluation/adapters/projections/            → AnalysisProjections (runtime, lightweight)
└── libs/evaluation/adapters/targets/                → EvaluationTarget + pre-wired evaluator singletons

USE CASES
├── libs/grammar/application/parse-only.ts                  parseOnly (convert without evaluation)
├── libs/evaluation/application/check-program.ts            createProgram, createProgramFromTSProgram
├── libs/evaluation/application/check-project.ts            checkProject (config + file discovery + evaluation)
├── libs/behavior/application/run-codegen.ts                 runCodegenPipeline (validate + compile + write)
└── libs/behavior/application/run-all-codegen.ts             runAllCodegen (multi-target orchestration)

CODEGEN TARGETS (CLI wiring — apps/cli/codegen/)
└── apps/cli/codegen/targets.ts                            CodegenTarget definitions (grammar + decl pairings)

NPM API (direct exports from libs/ — no shim layer)
├── libs/core/src/index.ts                     npm root: Kind, PropertySet, defineConfig, KindScriptConfig
└── libs/evaluation/index.ts        npm /ts-kind-checking: createProgram, parseOnly, domain types

APPS (apps/ — thin runnable shells with per-command composition roots)
├── apps/cli/main.ts               CLI top-level: registers lazy command loaders
├── apps/cli/codegen/              Codegen wiring (targets + compose)
├── apps/cli/evaluation/           Evaluation wiring (compose)
└── apps/cli/cli/commands/         Pure command handlers (receive deps, no direct imports)
```

The K type parameter links grammar and spec at composition boundaries —
TypeScript prevents mismatched grammar/spec pairs.

## Directory Structure

```
libs/                              Source code (bounded contexts)
  api.ts                          Lightweight npm root: Kind, PropertySet, defineConfig, KindScriptConfig

  grammar/                        Grammar bounded context (leaf — no deps on codegen/evaluation)
    domain/                       Ports + base types (pure contracts)
      ports.ts                    Grammar<K>, ASTNode, FieldDef, AstTranslatorPort
      base-types.ts               KSNodeBase, KSCommentRange
      schema-shapes.ts            NodeDefShape, SumTypeDefShape, FieldDescShape
      dep-graph-types.ts          AttributeDepGraph (shared data interface)
    application/                  Grammar utilities + use cases
      metadata.ts                 createGrammarMetadata(), computeFieldDefs(), etc.
      tree-ops.ts                 getChildren(), createNode(), serialization (lossless round-trip)
      serialize-tree.ts           serializeNode() — generic presentation-friendly serialization
      parse-only.ts               parseOnly() — convert TS AST to KS AST without evaluation
    adapters/                     Grammar implementations
      grammars/
        ts-ast/                   Grammar<TSNodeKind> (364 node kinds)
          nodes.ts                Node kind declarations (as const satisfies, plain objects)
          index.ts                Barrel — grammar object, concrete types, runtime metadata
        mock/                     Grammar<MockKind> (5 node kinds)
          nodes.ts, index.ts
      translators/
        ts-ast/                   AstTranslatorPort<ts.Program, KSProgram, AnalysisDepth>
          convert.ts              Hand-written schema-driven converter + tsToAstTranslatorAdapter
          helpers.ts              TS-specific extractor helpers (pure — ConvertContext passed in)
          custom-extractors.ts    Per-kind extraction overrides
      extraction/
        ts-ast/                   TS-specific tree serialization for dashboard
          extract.ts              extractASTData() — uses serializeNode() + TS-specific logic
          types.ts                ASTDashboardData, ASTSchemaInfo
          index.ts                Barrel
    index.ts                      Barrel

  codegen/                        Codegen bounded context
    domain/                       Ports and types (pure contracts)
      ports.ts                    AnalysisDecl<K>, AttrDecl<K>, AttrExpr, CodeLiteral, code()
      types.ts                    CodegenTarget<K>, GeneratedImports, CompiledAnalyzer
    application/                  Codegen machinery (use cases)
      compile.ts                  compileAnalysis(), buildDepGraph(), validateSpecConsistency()
      validate.ts                 validateSpec()
      pivot.ts                    pivotToAttrCentric()
      equation-utils.ts           withDeps(), collectDepsForAttr()
      run-codegen.ts              Use case: runCodegenPipeline (validate + compile + write)
      run-all-codegen.ts          Use case: runAllCodegen (multi-target orchestration)
    adapters/                     Analysis authoring
      analyses/
        ts-kind-checking/         AnalysisDecl<TSNodeKind> (12 attrs)
          spec.ts                 AnalysisDecl (codegen-time, heavy — loads equations + pivot)
          types.ts                Domain types (KindDefinition, Diagnostic, PropertySet, Kind<R>)
          equations/              Per-kind equation functions (definitions, attributes, predicates)
          generated/              Machine-generated codegen output (dispatch.ts, attr-types.ts, dep-graph.ts)
          index.ts                Barrel
        eslint-equiv/             AnalysisDecl<TSNodeKind> (40+ attrs)
          spec.ts, types.ts, equations/, generated/, index.ts
        mock/                     AnalysisDecl<MockKind> (1 attr)
          spec.ts, generated/, index.ts
    index.ts                      Barrel

  evaluation/                     Evaluator bounded context (lean, generic)
    domain/                       Core engine + ports (pure contracts)
      ports.ts                    DispatchConfig, EvaluatorConfig, EvaluationTarget, TypedAGNode
      ctx.ts                      Ctx, KindCtx<N> (equation function context)
      analysis-ports.ts           AnalysisProjections<M,P> (runtime analysis interface)
      engine.ts                   AGNode, createEvaluator(), createEvaluatorFromTarget(), Evaluator<M,P>
      evaluator-index.ts          Barrel re-exporting engine ports (used by generated files)
    application/                  Use cases (orchestration)
      types.ts                    CheckDeps, KSProgramInterface, re-exports KindScriptConfig/defineConfig
      check-program.ts            Use case: createProgram, createProgramFromTSProgram
      check-project.ts            Use case: checkProject (config + file discovery + evaluation)
      config.ts                   Use case: findConfig, loadConfig, resolveConfig
      find-files.ts               Use case: findRootFiles (TS file discovery)
    adapters/                     Runtime adapters (slimmed — NO grammar/analysis authoring)
      projections/                Analysis projections (runtime, lightweight — no equations)
        ts-kind-checking.ts       analysisProjections for ts-kind-checking
        eslint-equiv.ts           analysisProjections for eslint-equiv
        mock.ts                   analysisProjections for mock
      targets/                    Pre-wired evaluator instances
        ts-kind-checking.ts       EvaluationTarget + evaluator + translator singleton
        eslint-equiv.ts           EvaluationTarget + evaluator singleton
        mock.ts                   EvaluationTarget + evaluator singleton
    index.ts                      Barrel: npm "ksc/ts-kind-checking" entry point

apps/                             Runnable application shells
  cli/                            CLI application (check, codegen, init)
    main.ts                       Top-level composition root — registers lazy command loaders
    bin.ts                        Executable entry point
    cli/
      dispatch.ts                 Generic dispatch — parses args, loads command via CommandLoader
      args.ts                     Argument parsing and flag validation
      errors.ts                   CLIError, exit codes
      format.ts                   Output formatting (JSON/text)
      commands/                   Pure command handlers (receive deps as parameters)
        check.ts                  Check handler — accepts CheckCommandDeps
        codegen.ts                Codegen handler — accepts CodegenCommandDeps
        init.ts                   Init handler — writes config scaffold (no deps)
    codegen/                      Codegen wiring (CLI-specific)
      targets.ts                  CodegenTarget definitions (grammar + decl pairings)
      compose.ts                  Wires codegen path → codegenCommand
    evaluation/                   Evaluation wiring (CLI-specific)
      compose.ts                  Wires evaluation path → checkCommand
```

## npm Package — Subpath Exports

The `ksc` npm package has two entry points via `package.json` `exports`.
Both point directly at `libs/` files — no shim layer.

| Import path | Entry point | What it exports |
|---|---|---|
| `ksc` | `libs/core/src/index.ts` | `Kind`, `PropertySet`, `defineConfig`, `KindScriptConfig` |
| `ksc/ts-kind-checking` | `libs/evaluation/index.ts` | `createProgram`, `parseOnly`, `KSProgramInterface`, `KindDefinition`, `Diagnostic` |

**`ksc`** is lightweight — phantom types and config helpers with zero heavyweight deps.
Every user installs this. Used in source code annotations and `ksc.config.ts`.

**`ksc/ts-kind-checking`** pulls in the full evaluator, grammar, AST translator, and analyses.
Used by tool builders who need programmatic access (IDE plugins, CI scripts, dashboards).
The subpath name makes the concrete analysis target explicit.

## Grammar-Level Barrels

Each grammar has a barrel (`libs/grammar/adapters/grammars/<target>/index.ts`) that:
1. Imports raw `NODES` and `SUM_TYPES` from `nodes.ts`
2. Propagates sum type fields (e.g., Expression.typeString → all member kinds)
3. Exports `grammar: Grammar<K>` — the port-conforming grammar object
4. Exports concrete types: `KSNode`, `KindToNode`, specific node interfaces
5. Exports utility functions: `getChildren()`, `createNode()`, serialization

Each AST translator exports a port-conforming object (e.g., `tsToAstTranslatorAdapter: AstTranslatorPort<Input, Root, Opts>`) for the target module.

## Analysis Codegen

Analysis codegen is the **only codegen** in the system. Targets are defined in
`apps/cli/codegen/targets.ts` and run via the CLI:

```
ksc codegen  →  ts-kind-checking → libs/behavior/adapters/analyses/ts-kind-checking/generated/
             →  mock             → libs/behavior/adapters/analyses/mock/generated/
             →  eslint-equiv     → libs/behavior/adapters/analyses/eslint-equiv/generated/
```

### Adding a new codegen target

1. Import `grammar` from `libs/grammar/adapters/grammars/<target>/index.ts`
2. Import `analysisDecl` from `libs/behavior/adapters/analyses/<analysis>/spec.ts`
3. Add a `CodegenTarget<K>` to `apps/cli/codegen/targets.ts`
4. Add the target to `allTargets` in that same file

### Adding a new evaluation target

1. Run codegen to generate `dispatch.ts`, `attr-types.ts`, `dep-graph.ts`
2. Create `libs/evaluation/adapters/projections/<target>.ts` — lightweight runtime projections
3. Create `libs/evaluation/adapters/targets/<target>.ts` — the composition root
4. Construct an `EvaluationTarget<K, M, P>` from: grammar, dispatchConfig, analysisProjections, depGraph
5. Call `createEvaluatorFromTarget(target)` to get the evaluator singleton
6. Re-export `evaluator`, `translator`, `depGraph` for use case modules

## Port Contracts

### Grammar<K> — what a grammar provides

```typescript
interface Grammar<K extends string = string> {
  readonly fieldDefs: Record<string, readonly FieldDef[]>;
  readonly allKinds: ReadonlySet<K>;
  readonly fileContainerKind: K;
  readonly fileNameField: string;
  readonly sumTypeMembers: Record<string, readonly string[]>;
  readonly sumTypeMembership: Record<string, readonly string[]>;
}
```

### AstTranslatorPort<Input, Root, Opts> — what a converter provides

```typescript
interface AstTranslatorPort<Input = unknown, Root extends ASTNode = ASTNode, Opts = unknown> {
  convert(input: Input, opts?: Opts): { root: Root };
}
```

### AnalysisDecl<K> — what an analysis declares (codegen-time)

```typescript
interface AnalysisDecl<K extends string = string> {
  attrs: AttrDecl<K>[];
  typeImports?: (paths: ImportPaths) => string[];
}
```

### AnalysisProjections<M, P> — what an analysis provides at runtime

```typescript
interface AnalysisProjections<M = Record<string, unknown>, P extends Record<string, unknown> = Record<string, unknown>> {
  projections: { [Key in keyof P]: (root: TypedAGNode<M>) => P[Key] };
  setup?: () => void;
}
```

`AnalysisDecl` (codegen-time: attrs + typeImports, in `libs/behavior/domain/ports.ts`) and
`AnalysisProjections` (runtime: projections, in `libs/evaluation/domain/analysis-ports.ts`)
are fully independent interfaces. Heavy analyses split `spec.ts` (AnalysisDecl, in `libs/behavior/adapters/`)
from projections (AnalysisProjections, in `libs/evaluation/adapters/projections/`).

### CodegenTarget<K> — what a codegen root provides

```typescript
interface CodegenTarget<K extends string = string> {
  grammar: Grammar<K>;
  decl: AnalysisDecl<K>;
  outputDir: string;
  generatedImports: GeneratedImports;
}
```

### EvaluationTarget<K, M, P> — what a fully-assembled analysis provides at runtime

```typescript
interface EvaluationTarget<K extends string = string, M = Record<string, unknown>, P extends Record<string, unknown> = Record<string, unknown>> {
  grammar: Grammar<K>;
  dispatch: DispatchConfig;
  projections: AnalysisProjections<M, P>;
  depGraph: AttributeDepGraph;
}
```

Symmetric counterpart to `CodegenTarget<K>`. `CodegenTarget` bundles grammar + AnalysisDecl
for build-time codegen; `EvaluationTarget` bundles grammar + generated dispatch + projections +
dep graph for runtime. Target modules construct an `EvaluationTarget` from concrete implementations,
then pass it to `createEvaluatorFromTarget()` to get a ready-to-use `Evaluator`.

### DispatchConfig — what generated dispatch provides

```typescript
type DispatchConfig = Record<string, DispatchEntry>;
// DispatchEntry = SynDispatchEntry | InhDispatchEntry | CollectionDispatchEntry
```

## Implementations

### Current implementations

| Implementation | Port | Location |
|---|---|---|
| TS AST grammar | `Grammar<TSNodeKind>` | `libs/grammar/adapters/grammars/ts-ast/index.ts` |
| TS AST translator | `AstTranslatorPort<ts.Program, KSProgram, AnalysisDepth>` | `libs/grammar/adapters/translators/ts-ast/convert.ts` |
| TS AST extraction | `extractASTData` (uses `serializeNode`) | `libs/grammar/adapters/extraction/ts-ast/extract.ts` |
| Kind-checking decl | `AnalysisDecl<TSNodeKind>` | `libs/behavior/adapters/analyses/ts-kind-checking/spec.ts` |
| Kind-checking projections | `AnalysisProjections<KSCProjections>` | `libs/evaluation/adapters/projections/ts-kind-checking.ts` |
| ESLint-equiv decl | `AnalysisDecl<TSNodeKind>` | `libs/behavior/adapters/analyses/eslint-equiv/spec.ts` |
| ESLint-equiv projections | `AnalysisProjections<EslintEquivProjections>` | `libs/evaluation/adapters/projections/eslint-equiv.ts` |
| Mock grammar | `Grammar<MockKind>` | `libs/grammar/adapters/grammars/mock/index.ts` |
| Mock decl | `AnalysisDecl<MockKind>` | `libs/behavior/adapters/analyses/mock/spec.ts` |
| Mock projections | `AnalysisProjections<MockProjections>` | `libs/evaluation/adapters/projections/mock.ts` |

### Adding a new implementation

**New grammar** (e.g., Python AST):
1. Create `libs/grammar/adapters/grammars/python-ast/nodes.ts` — `NODES` and `SUM_TYPES` as `as const satisfies` objects
2. Create `libs/grammar/adapters/grammars/python-ast/index.ts` — barrel with `grammar: Grammar<PyNodeKind>`
3. Create `libs/grammar/adapters/translators/python-ast/convert.ts` — `pyToAstTranslatorAdapter: AstTranslatorPort<PyInput, KSProgram, PyOpts>`
4. The `libs/grammar/` machinery is reused — zero changes needed

**New analysis** (e.g., complexity analysis over TS AST):
1. Create `libs/behavior/adapters/analyses/complexity/spec.ts` with `analysisDecl: AnalysisDecl<TSNodeKind>` (codegen-time attrs)
2. Create `libs/behavior/adapters/analyses/complexity/types.ts` for analysis-specific vocabulary — use concrete grammar node types (see ADR-001)
3. Create `libs/behavior/adapters/analyses/complexity/equations/` — equation functions with `withDeps()`
4. Create `libs/behavior/adapters/analyses/complexity/index.ts` barrel — re-export grammar, `TSNodeKind`, `KSNode`, `KindToNode`
5. Add `CodegenTarget<TSNodeKind>` to `apps/cli/codegen/targets.ts`
6. Run `ksc codegen` to generate dispatch + attr-types + dep-graph
7. Create `libs/evaluation/adapters/projections/complexity.ts` with `analysisProjections: AnalysisProjections<ComplexityAttrMap, ComplexityProjections>` (runtime)
8. Create `libs/evaluation/adapters/targets/complexity.ts` — EvaluationTarget + evaluator singleton

## Codegen Commands

```bash
ksc codegen                                              # via CLI (runs all targets)
npm run codegen                                          # same, via npm script
npm run codegen:analysis                                 # same as codegen
```

## Testing

```bash
npx vitest run                      # all tests
npx vitest run --testTimeout=30000  # with timeout for slow fixtures
npx vitest run test/e2e/e2e.test.ts # single file
```

## Key Conventions

- Grammar schemas use plain `as const satisfies` objects — no builder DSL, no codegen
- AG attribute directions: `syn` (synthesized), `inh` (inherited), `collection`
- AttrDecl is a discriminated union: SynAttr (default + equations), InhAttr (rootValue + parentEquations), CollectionAttr (init + combine)
- AttrDecl fields use `AttrExpr` (Function | null | number | boolean | CodeLiteral) — not strings
- Equation records use `EquationMap<K>` (= `Partial<Record<K, EquationFn>>`) — typed replacement for `Partial<Record<K, Function>>` (see ADR-002)
- `withDeps(deps, fn)` attaches dep metadata to equation functions; `collectDepsForAttr(attr)` reads it
- `code(expr)` wraps raw code strings as CodeLiteral; equation functions are direct Function references
- Equation functions use standardized signatures: `(ctx: Ctx)` or `(ctx: Ctx, param: ParamType)`
- Parameterized attributes (JastAdd-style): optional `parameter: { name, type }` on any attr, generates Map-based caching
- Equations: syn equations are Function refs, inh parentEquations return `T | undefined` (undefined = copy-down)
- Generated files have `AUTO-GENERATED` headers — never edit them manually
- Generated output lives inside its analysis: `libs/behavior/adapters/analyses/<name>/generated/` (private impl detail)
- `libs/behavior/adapters/analyses/ts-kind-checking/generated/` is committed so consumers don't need codegen
- `libs/behavior/adapters/analyses/mock/generated/` is gitignored (test artifact only)
- Domain types (`KindDefinition`, `Diagnostic`, `ViolationRule`) live in `libs/behavior/adapters/analyses/`, not in workspace packages
- Projection keys use domain names (`definitions`, `diagnostics`), not compiler-pass names
- `KSNodeBase` has `[key: string]: unknown` index signature for structural cast compatibility
- Generated dispatch functions use `ctx as unknown as KindCtx<...>` for per-kind equation casts
- Evaluator is hand-written (`libs/evaluation/domain/engine.ts`), dispatch functions are generated (`libs/behavior/adapters/analyses/*/generated/dispatch.ts`)
- **Strict clean architecture** — every bounded context has exactly `{domain, application, adapters}` + `index.ts`
- **Grammar ports** in `libs/grammar/domain/ports.ts`, codegen ports in `libs/behavior/domain/ports.ts`, evaluator ports in `libs/evaluation/domain/ports.ts`
- **Boundary enforcement** via ESLint `no-restricted-imports` in `eslint.config.js`
- **Directory convention**: grammars at `libs/grammar/adapters/grammars/<target>/`, translators at `libs/grammar/adapters/translators/<target>/`, analyses at `libs/behavior/adapters/analyses/<analysis>/`, projections at `libs/evaluation/adapters/projections/<analysis>.ts`, targets at `libs/evaluation/adapters/targets/<target>.ts`
- Implementations use explicit type annotations (e.g., `grammar: Grammar<TSNodeKind>`) for conformance
- **Evaluation bounded context** (`libs/evaluation/`) — lean generic executor. `domain/` holds engine + ports, `application/` holds use cases, `adapters/` holds only projections + targets (NO grammar/analysis authoring)
- **Codegen bounded context** (`libs/behavior/`) — owns analysis authoring. `adapters/analyses/` contains specs, equations, types, and generated output
- **Grammar bounded context** (`libs/grammar/`) — owns grammars, translators, extraction, and parse-only pipeline
- **CLI has per-command composition roots** — `apps/cli/main.ts` lazy-loads `codegen/compose.ts` and `evaluation/compose.ts` via dynamic `import()`, so `ksc check` never loads codegen and `ksc codegen` never creates the evaluator. Command handlers in `cli/commands/` are pure functions that receive deps as parameters.
- **Codegen targets are CLI wiring** — `apps/cli/codegen/targets.ts` defines `CodegenTarget<K>` objects pairing grammar + analysis decl (CLI-specific, not in `libs/behavior/`)
- **Entry points are thin shells** — `apps/cli` delegates to evaluation/codegen use cases
- **`libs/core/src/index.ts`** is the lightweight npm root — `Kind`, `PropertySet`, `defineConfig` (zero heavyweight deps)
- **`libs/evaluation/index.ts`** is the heavyweight npm entry (`ksc/ts-kind-checking`)
- **Analysis spec/projections split** — specs (AnalysisDecl) live in `libs/behavior/adapters/analyses/<name>/spec.ts`, projections (AnalysisProjections) live in `libs/evaluation/adapters/projections/<name>.ts`
- `buildKSTree` is internal to the AST translator — consumers use `tsToAstTranslatorAdapter.convert()`

## Documentation Management

The project maintains a **fixed set** of committed documentation. Everything else
lives in `.working/` (gitignored) and is not checked into git.

### Committed docs (fixed set)

```
README.md                     User-facing: what KSC is, CLI usage, npm API
CLAUDE.md                     Developer guide: architecture, conventions, ports
docs/
  ARCHITECTURE.md             System architecture overview
  BACKLOG.md                  Living backlog: analyses, attributes, verification
  adr/
    README.md                 ADR index
    NNN-*.md                  Architecture Decision Records
libs/grammar/README.md         Grammar bounded context guide
libs/behavior/README.md         Codegen bounded context guide
libs/evaluation/README.md      Evaluation bounded context guide
apps/cli/README.md            CLI application guide
```

### Working docs (.working/ — gitignored)

Research, analysis, plans, design docs, and exploration go in `.working/`.
These are working documents, not permanent reference. Subdirectories:

```
.working/
  research/        Research docs, market analysis, comparisons
  analysis/        Architecture analysis, bounded context analysis
  design/          Active design docs (e.g., protobuf enforcement)
  plans/           Implementation plans (completed and in-progress)
  reviews/         Architecture reviews
  archive/         Historical docs
```

### When to update committed docs

| Trigger | Update |
|---------|--------|
| New bounded context | CLAUDE.md (directory structure, ports), new README |
| New port or implementation | CLAUDE.md (ports table, implementations table) |
| npm export changed | README.md, CLAUDE.md |
| CLI command added/changed | README.md, apps/cli/README.md |
| Architectural decision | New ADR in `docs/adr/` |
| Convention changed | CLAUDE.md conventions section |
| New analysis assessed | docs/BACKLOG.md |
| Major refactor | CLAUDE.md directory structure, affected READMEs |
| Completed plan/design doc | Leave in `.working/` — do not promote |

### Rules

- No new `.md` files in `docs/` except ADRs — the set is closed
- Research, plans, and analysis docs go in `.working/` only
- When a design decision is significant enough to be permanent → write an ADR
- When a design changes architecture → update CLAUDE.md and ARCHITECTURE.md
- Bounded context READMEs stay focused on structure and ports, not implementation details

## Explicit Grammar Coupling

Analyses are **explicitly coupled** to their grammar.
This is an intentional architectural choice (see ADR-001), not an accident:

- Analysis barrels re-export their grammar (`grammar`, `TSNodeKind`, `KSNode`, `KindToNode`)
- Domain types use concrete node types (`KindDefinition.node: KSTypeAliasDeclaration`, `Diagnostic.node: KSNode`)
- Predicate constants are typed with the grammar's kind union (`ReadonlySet<TSNodeKind>`)
- Equation functions use `KindCtx<KSIdentifier>` etc. for type-safe node access
- **New analyses should follow the same pattern**: import concrete grammar types directly, don't abstract through generics

Each analysis is for **exactly one grammar**. Multiple analyses
can target the same grammar, but each is explicitly bound to one.
The `K` type parameter on `AnalysisDecl<K>` links them at the type level.
The grammar re-export from the analysis barrel makes the binding discoverable.

New analyses MUST:
1. Import grammar types directly from the grammar barrel
2. Re-export grammar, grammar kind type, and KindToNode from their own barrel
3. Use concrete node types in domain types (not `unknown`)
4. Type predicate sets with the grammar's kind union
5. See ADR-001 for rationale
