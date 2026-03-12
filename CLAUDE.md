# KindScript — Developer Guide

## Architecture Overview

KindScript is a **declarative attribute grammar system** with a **clean architecture**
(ports-and-adapters + application layer).

Core machinery lives in **npm workspace packages** under `packages/`:

- **`packages/core-grammar/`** — shared grammar types + utilities (leaf package)
- **`packages/core-codegen/`** — codegen machinery: compile, validate, pivot (depends on core-grammar only)
- **`packages/core-evaluator/`** — AG evaluator engine + runtime analysis interfaces (depends on core-grammar only)

Application code lives under `src/` and `apps/`:

- **`src/adapters/`** — pluggable adapter implementations
- **`src/application/`** — use cases (orchestrate wiring + ports)
- **`src/application/codegen/`** — codegen use cases + target definitions
- **`src/application/evaluation/`** — evaluation composition root (pre-compose adapters)

`apps/` (runnable shells) delegate to the application layer.
npm `package.json` exports point directly at `src/` — no shim layer.

**Codegen and evaluation are fully decoupled** — `core-codegen` cannot import from `core-evaluator`
and vice versa. Enforcement is physical via npm workspace package resolution.

- **Grammar ports** (`@kindscript/core-grammar`): `Grammar<K>`, `ASTNode`, `FieldDef`, `AstTranslatorPort<I,R,O>`
- **Codegen ports** (`@kindscript/core-codegen`): `AnalysisDecl<K>`, `AttrDecl<K>`, `EquationFn<T>`, `EquationMap<K,T>`, `TypedEquationMap<K,CtxMap,T>`, `CodegenTarget<K>`
- **Evaluator ports** (`@kindscript/core-evaluator`): `DispatchConfig`, `EvaluationTarget<K,M,P>`, `EvaluatorConfig<K,M,P>`, `Evaluator<M,P>`, `TypedAGNode<M>`, `Ctx`, `KindCtx<N>`, `AnalysisProjections<M,P>`

There is **no grammar codegen** — grammar types are derived at the type level, runtime
metadata is computed by pure utility functions, and converters are hand-written.

## Ports and Adapters

```
PORTS (contracts — in workspace packages, imported directly via @kindscript/core-*)
├── Grammar<K>             @kindscript/core-grammar     — what a grammar provides
├── AstTranslatorPort<I, R, O> @kindscript/core-grammar — what a converter provides
├── AnalysisDecl<K>        @kindscript/core-codegen      — what an analysis declares (codegen-time)
├── CodegenTarget<K>       @kindscript/core-codegen      — what a codegen root provides
├── DispatchConfig         @kindscript/core-evaluator    — what generated dispatch provides
├── Ctx / KindCtx<N>       @kindscript/core-evaluator    — how equations access the tree
├── AnalysisProjections<M, P> @kindscript/core-evaluator  — what an analysis provides at runtime
├── EvaluationTarget<K, M, P> @kindscript/core-evaluator — what a fully-assembled analysis provides at runtime
├── EvaluatorConfig<K, M, P>  @kindscript/core-evaluator — how the evaluator is assembled (low-level)
├── Evaluator<M, P>       @kindscript/core-evaluator    — evaluator interface (evaluate + buildTree)
└── TypedAGNode<M>         @kindscript/core-evaluator    — type-safe attribute access

ADAPTERS (implementations — organized by lib, then port, then target)
├── src/adapters/grammar/grammar/ts-ast/          → Grammar<TSNodeKind>
├── src/adapters/grammar/grammar/mock/            → Grammar<MockKind>
├── src/adapters/grammar/ast-translator/ts-ast/   → AstTranslatorPort<ts.Program, KSProgram, AnalysisDepth>
├── src/adapters/grammar/extraction/ts-ast/       → extractASTData (TS-specific tree serialization)
├── src/adapters/analysis/spec/ts-kind-checking/  → AnalysisDecl (spec.ts) + AnalysisProjections (projections.ts)
└── src/adapters/analysis/spec/mock/              → AnalysisDecl + AnalysisProjections (both from spec.ts)

APPLICATION (use cases — shared orchestration)
├── src/application/check-program.ts                     createProgram, createProgramFromTSProgram
├── src/application/parse-only.ts                        parseOnly (convert without evaluation)
├── src/application/evaluation/ts-kind-checking.ts       EvaluationTarget + pre-wired evaluator + translator
├── src/application/codegen/run-codegen.ts               runCodegenPipeline (validate + compile + write)
├── src/application/codegen/codegen-targets.ts           CodegenTarget definitions (grammar + decl pairings)
└── src/application/index.ts                             Barrel: npm "kindscript/ts-kind-checking" entry

NPM API (direct exports from src/ — no shim layer)
├── src/api.ts                     npm root: Kind, PropertySet, defineConfig, KindScriptConfig
└── src/application/index.ts       npm /ts-kind-checking: createProgram, parseOnly, domain types

APPS (apps/ — thin runnable shells with per-command composition roots)
├── apps/cli/cli.ts                CLI top-level: lazy-loads per-command composition roots
├── apps/cli/compose/              Per-command composition roots (wire adapters → command handlers)
│   ├── compose-check.ts           Evaluation path: checkProject → checkCommand
│   ├── compose-codegen.ts         Codegen path: allTargets + runAllCodegen → codegenCommand
│   └── compose-init.ts            Lightweight: initCommand (no adapters)
├── apps/cli/commands/             Pure command handlers (receive deps, no adapter imports)
├── apps/dashboard/                Vite + React AST visualization SPA
│   └── compose.ts                 Extraction path: parseOnly + extractASTData → ASTDashboardData
```

The K type parameter links grammar and spec at composition boundaries —
TypeScript prevents mismatched grammar/spec pairs.

## Directory Structure

```
packages/                         Workspace packages (source of truth for core machinery)
  core-grammar/                   Shared grammar types + utilities (leaf package)
    src/
      ports.ts                    Grammar<K>, ASTNode, FieldDef, AstTranslatorPort
      base-types.ts               KSNodeBase, KSCommentRange
      schema-shapes.ts            NodeDefShape, SumTypeDefShape, FieldDescShape
      metadata.ts                 createGrammarMetadata(), computeFieldDefs(), etc.
      tree-ops.ts                 getChildren(), createNode(), serialization (lossless round-trip)
      serialize-tree.ts           serializeNode() — generic presentation-friendly serialization
      dep-graph-types.ts          AttributeDepGraph (shared data interface)
      index.ts                    Barrel
  core-codegen/                   Codegen machinery (depends on core-grammar only)
    src/
      ports.ts                    AnalysisDecl<K>, AttrDecl<K>, AttrExpr, CodeLiteral, code()
      codegen-types.ts            CodegenTarget<K>, GeneratedImports, CompiledAnalyzer
      compile.ts                  compileAnalysis(), buildDepGraph(), validateSpecConsistency()
      validate.ts                 validateSpec()
      pivot.ts                    pivotToAttrCentric()
      equation-utils.ts           withDeps(), collectDepsForAttr()
      index.ts                    Barrel
  core-evaluator/                 AG evaluator engine (depends on core-grammar only)
    src/
      ctx.ts                      Ctx, KindCtx<N> (equation function context)
      analysis-ports.ts           AnalysisProjections<P> (runtime analysis interface)
      engine.ts                   AGNode, createEvaluator(), createEvaluatorFromTarget(), validateDispatch(), Evaluator<M,P>
      ports.ts                    DispatchConfig, EvaluatorConfig, EvaluationTarget, TypedAGNode, AGNodeInterface
      index.ts                    Barrel

src/                              Application source code
  api.ts                          Lightweight npm root: Kind, PropertySet, defineConfig, KindScriptConfig

  adapters/                       Adapter implementations (organized by lib, then port, then target)
    grammar/
      grammar/
        ts-ast/                   Adapter: Grammar<TSNodeKind> (364 node kinds)
          nodes.ts                Node kind declarations (as const satisfies, plain objects)
          index.ts                Adapter barrel — grammar object, concrete types, runtime metadata
        mock/                     Adapter: Grammar<MockKind> (5 node kinds)
          nodes.ts, index.ts
      ast-translator/
        ts-ast/                   Adapter: AstTranslatorPort<ts.Program, KSProgram, AnalysisDepth>
          convert.ts              Hand-written schema-driven converter + tsToAstTranslatorAdapter
          helpers.ts              TS-specific extractor helpers (pure — ConvertContext passed in)
      extraction/
        ts-ast/                   Adapter: TS-specific tree serialization
          extract.ts              extractASTData() — uses serializeNode() + TS-specific logic
          types.ts                ASTDashboardData, ASTSchemaInfo
          index.ts                Barrel
    analysis/
      spec/
        ts-kind-checking/         Adapter: AnalysisDecl<TSNodeKind> + AnalysisProjections<KSCProjections>
          types.ts                Domain types (KindDefinition, Diagnostic, PropertySet, Kind<R>)
          equations/              Per-kind equation functions (definitions, attributes, predicates)
          spec.ts                 AnalysisDecl (8 attrs: codegen-time, heavy — loads equations + pivot)
          projections.ts          AnalysisProjections (runtime, lightweight — no equations)
          generated/              Machine-generated codegen output (dispatch.ts, attr-types.ts, dep-graph.ts)
        mock/                     Adapter: AnalysisDecl<MockKind> + AnalysisProjections<MockProjections> (1 attr)
          spec.ts                 analysisDecl (codegen) + analysisProjections (lightweight)
          generated/              Machine-generated codegen output (gitignored, test artifact)

  application/                    Application layer — use cases + npm heavyweight entry
    check-program.ts              Use case: createProgram, createProgramFromTSProgram
    check-project.ts              Use case: checkProject (config + file discovery + evaluation)
    parse-only.ts                 Use case: parseOnly (convert without evaluation)
    config.ts                     Use case: findConfig, loadConfig, resolveConfig
    find-files.ts                 Use case: findRootFiles (TS file discovery)
    types.ts                      KSProgramInterface, re-exports KindScriptConfig/defineConfig
    index.ts                      Barrel: npm "kindscript/ts-kind-checking" entry point
    evaluation/                    Evaluation wiring (separate from codegen)
      ts-kind-checking.ts         Pre-wired evaluator + translator singleton
    codegen/                      Codegen use cases (separate from evaluation)
      run-codegen.ts              Use case: runCodegenPipeline (validate + compile + write)
      run-all-codegen.ts          Use case: runAllCodegen (multi-target orchestration)
      codegen-targets.ts          CodegenTarget definitions (grammar + decl pairings)

apps/                             Runnable application shells
  cli/                            CLI application (check, codegen, init)
    cli.ts                        Top-level composition root — lazy-loads per-command roots
    dispatch.ts                   Generic dispatch — parses args, loads command via CommandLoader
    compose/                      Per-command composition roots (loaded on demand)
      compose-check.ts            Wires evaluation path → checkCommand
      compose-codegen.ts          Wires codegen path → codegenCommand
      compose-init.ts             Wraps initCommand (lightweight, no adapters)
    commands/                     Pure command handlers (receive deps as parameters)
      check.ts                    Check handler — accepts CheckCommandDeps
      codegen.ts                  Codegen handler — accepts CodegenCommandDeps
      init.ts                     Init handler — writes config scaffold (no deps)
  dashboard/                      AST visualization (Vite + React + D3 SPA)
    compose.ts                    Extraction composition root (parseOnly + extractASTData)
    app/                          React application source (components, state, hooks, types)
    vite.config.ts                Vite dev server + build config
```

## npm Package — Subpath Exports

The `kindscript` npm package has two entry points via `package.json` `exports`.
Both point directly at `src/` files — no shim layer.

| Import path | Entry point | What it exports |
|---|---|---|
| `kindscript` | `src/api.ts` | `Kind`, `PropertySet`, `defineConfig`, `KindScriptConfig` |
| `kindscript/ts-kind-checking` | `src/application/index.ts` | `createProgram`, `parseOnly`, `KSProgramInterface`, `KindDefinition`, `Diagnostic` |

**`kindscript`** is lightweight — phantom types and config helpers with zero heavyweight deps.
Every user installs this. Used in source code annotations and `ksc.config.ts`.

**`kindscript/ts-kind-checking`** pulls in the full evaluator, grammar, AST translator, and adapters.
Used by tool builders who need programmatic access (IDE plugins, CI scripts, dashboards).
The subpath name makes the concrete analysis target explicit.

## Adapter-Level Barrels

Each grammar adapter has a barrel (`src/adapters/grammar/grammar/<target>/index.ts`) that:
1. Imports raw `NODES` and `SUM_TYPES` from `nodes.ts`
2. Propagates sum type fields (e.g., Expression.typeString → all member kinds)
3. Exports `grammar: Grammar<K>` — the port-conforming grammar object
4. Exports concrete types: `KSNode`, `KindToNode`, specific node interfaces
5. Exports utility functions: `getChildren()`, `createNode()`, serialization

Each AST translator adapter exports a port-conforming object (e.g., `tsToAstTranslatorAdapter: AstTranslatorPort<Input, Root, Opts>`) for the composition root.

## Analysis Codegen

Analysis codegen is the **only codegen** in the system. Targets are defined in
`src/application/codegen/codegen-targets.ts` and run via the CLI:

```
ksc codegen  →  ts-kind-checking → src/adapters/analysis/spec/ts-kind-checking/generated/
             →  mock             → src/adapters/analysis/spec/mock/generated/
```

### Adding a new codegen target

1. Import `grammar` from `src/adapters/grammar/grammar/<target>/index.ts`
2. Import `analysisDecl` from `src/adapters/analysis/spec/<analysis>/spec.ts`
3. Add a `CodegenTarget<K>` to `src/application/codegen/codegen-targets.ts`
4. Add the target to `allTargets` in that same file

### Adding a new evaluation target

1. Run codegen to generate `dispatch.ts`, `attr-types.ts`, `dep-graph.ts`
2. Create `src/application/evaluation/<target>.ts` — the composition root
3. Construct an `EvaluationTarget<K, M, P>` from: grammar, dispatchConfig, analysisProjections, depGraph
4. Call `createEvaluatorFromTarget(target)` to get the evaluator singleton
5. Re-export `evaluator`, `translator`, `depGraph` for use case modules

## Port Contracts

### Grammar<K> — what a grammar provides

```typescript
interface Grammar<K extends string = string> {
  readonly fieldDefs: Record<string, readonly FieldDef[]>;
  readonly allKinds: ReadonlySet<K>;
  readonly rootKind: K;
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

Adapters with heavy codegen imports split into separate `spec.ts` (AnalysisDecl)
and `projections.ts` (AnalysisProjections) modules. There is no combined `AnalysisSpec`
— the two interfaces are independent and live in separate packages.

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
dep graph for runtime. Composition roots construct an `EvaluationTarget` from concrete adapters,
then pass it to `createEvaluatorFromTarget()` to get a ready-to-use `Evaluator`.

### DispatchConfig — what generated dispatch provides

```typescript
type DispatchConfig = Record<string, DispatchEntry>;
// DispatchEntry = SynDispatchEntry | InhDispatchEntry | CollectionDispatchEntry
```

## Adapters

### Current adapters

| Adapter | Port | Location |
|---|---|---|
| TS AST grammar | `Grammar<TSNodeKind>` | `src/adapters/grammar/grammar/ts-ast/index.ts` |
| TS AST translator | `AstTranslatorPort<ts.Program, KSProgram, AnalysisDepth>` | `src/adapters/grammar/ast-translator/ts-ast/convert.ts` |
| TS AST extraction | `extractASTData` (uses `serializeNode` from core-grammar) | `src/adapters/grammar/extraction/ts-ast/extract.ts` |
| Kind-checking decl | `AnalysisDecl<TSNodeKind>` | `src/adapters/analysis/spec/ts-kind-checking/spec.ts` |
| Kind-checking projections | `AnalysisProjections<KSCProjections>` | `src/adapters/analysis/spec/ts-kind-checking/projections.ts` |
| Mock grammar | `Grammar<MockKind>` | `src/adapters/grammar/grammar/mock/index.ts` |
| Mock analysis | `AnalysisDecl<MockKind>` + `AnalysisProjections<MockProjections>` | `src/adapters/analysis/spec/mock/spec.ts` |

### Adding a new adapter

**New grammar** (e.g., Python AST):
1. Create `src/adapters/grammar/grammar/python-ast/nodes.ts` — `NODES` and `SUM_TYPES` as `as const satisfies` objects
2. Create `src/adapters/grammar/grammar/python-ast/index.ts` — barrel with `grammar: Grammar<PyNodeKind>`
3. Create `src/adapters/grammar/ast-translator/python-ast/convert.ts` — `pyToAstTranslatorAdapter: AstTranslatorPort<PyInput, KSProgram, PyOpts>`
4. The `@kindscript/core-grammar` machinery is reused — zero changes needed

**New analysis** (e.g., complexity analysis over TS AST):
1. Create `src/adapters/analysis/spec/complexity/spec.ts` with `analysisDecl: AnalysisDecl<TSNodeKind>` (codegen-time attrs)
2. Create `src/adapters/analysis/spec/complexity/projections.ts` with `analysisProjections: AnalysisProjections<ComplexityAttrMap, ComplexityProjections>` (runtime)
3. Create `src/adapters/analysis/spec/complexity/types.ts` for analysis-specific vocabulary — use concrete grammar node types (see ADR-001)
4. Create `src/adapters/analysis/spec/complexity/equations/` — equation functions with `withDeps()`
5. Create `src/adapters/analysis/spec/complexity/index.ts` barrel — re-export grammar, `TSNodeKind`, `KSNode`, `KindToNode`
6. Add `CodegenTarget<TSNodeKind>` to `src/application/codegen/codegen-targets.ts`
7. The `@kindscript/core-codegen` machinery is reused — it's fully generic

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
- Generated output lives inside its adapter: `src/adapters/analysis/spec/<name>/generated/` (private impl detail)
- `src/adapters/analysis/spec/ts-kind-checking/generated/` is committed so consumers don't need codegen
- `src/adapters/analysis/spec/mock/generated/` is gitignored (test artifact only)
- Domain types (`KindDefinition`, `Diagnostic`, `ViolationRule`) live in `src/adapters/analysis/`, not in workspace packages
- Projection keys use domain names (`definitions`, `diagnostics`), not compiler-pass names
- `KSNodeBase` has `[key: string]: unknown` index signature for structural cast compatibility
- Generated dispatch functions use `ctx as unknown as KindCtx<...>` for per-kind equation casts
- Evaluator is hand-written (`packages/core-evaluator/src/engine.ts`), dispatch functions are generated (`src/adapters/analysis/spec/*/generated/dispatch.ts`)
- **Workspace packages** — core machinery lives in `packages/core-grammar/`, `packages/core-codegen/`, `packages/core-evaluator/`
- **Codegen/evaluation decoupled** — `core-codegen` and `core-evaluator` cannot import from each other (enforced by npm workspace resolution)
- **No `src/core/` layer** — all consumers import directly from `@kindscript/core-grammar`, `@kindscript/core-codegen`, `@kindscript/core-evaluator`
- Port interfaces live in their respective packages: grammar ports in `core-grammar`, codegen ports in `core-codegen`, evaluator ports in `core-evaluator`
- **Adapter directory convention**: `src/adapters/<lib>/<portName>/<adapterName>/` — e.g., `src/adapters/grammar/grammar/ts-ast/`, `src/adapters/grammar/ast-translator/ts-ast/`, `src/adapters/analysis/spec/ts-kind-checking/`
- Adapters use explicit type annotations (e.g., `grammar: Grammar<TSNodeKind>`) for conformance
- **Application layer** (`src/application/`) holds shared use cases, evaluation wiring, and codegen use cases
- **Use cases** (`src/application/*.ts`) orchestrate ports into domain operations
- **CLI has per-command composition roots** — `apps/cli/cli.ts` lazy-loads `compose/compose-*.ts` via dynamic `import()`, so `ksc check` never loads codegen adapters and `ksc codegen` never creates the evaluator. Command handlers in `commands/` are pure functions that receive deps as parameters.
- **Entry points are thin shells** — `apps/cli` delegates to application-layer use cases
- **`src/api.ts`** is the lightweight npm root — `Kind`, `PropertySet`, `defineConfig` (zero heavyweight deps)
- **`src/application/index.ts`** is the heavyweight npm entry (`kindscript/ts-kind-checking`)
- **`apps/dashboard/`** is a standalone Vite + React SPA consuming serialized `ASTDashboardData`
- **Codegen pipeline** — `src/application/codegen/run-codegen.ts` provides `runCodegenPipeline(target)`, CLI orchestrates via `ksc codegen`
- **Codegen targets** — `src/application/codegen/codegen-targets.ts` defines `CodegenTarget<K>` objects pairing grammar + analysis decl
- **Evaluation targets** — `src/application/evaluation/ts-kind-checking.ts` constructs `EvaluationTarget<K, M, P>` and calls `createEvaluatorFromTarget()` — symmetric with `CodegenTarget`
- **Application layer split** — evaluation use cases at `src/application/` root, codegen use cases in `src/application/codegen/`
- **AnalysisDecl vs AnalysisProjections** — `AnalysisDecl` (codegen-time: attrs + typeImports, in `core-codegen`) vs `AnalysisProjections<M, P>` (runtime: projections via `TypedAGNode<M>` + setup, in `core-evaluator`) — fully independent interfaces in separate packages (see ADR-003)
- **Adapter spec/projections split** — heavy adapters (ts-kind-checking) export `analysisDecl` from `spec.ts` and `analysisProjections` from `projections.ts`; composition roots import only `projections.ts` at runtime
- `buildKSTree` is internal to the AST translator adapter — consumers use `tsToAstTranslatorAdapter.convert()`

## Explicit Grammar Coupling

Analysis adapters are **explicitly coupled** to their grammar adapter.
This is an intentional architectural choice (see ADR-001), not an accident:

- Analysis adapter barrels re-export their grammar (`grammar`, `TSNodeKind`, `KSNode`, `KindToNode`)
- Domain types use concrete node types (`KindDefinition.node: KSTypeAliasDeclaration`, `Diagnostic.node: KSNode`)
- Predicate constants are typed with the grammar's kind union (`ReadonlySet<TSNodeKind>`)
- Equation functions use `KindCtx<KSIdentifier>` etc. for type-safe node access
- **New analysis adapters should follow the same pattern**: import concrete grammar types directly, don't abstract through generics

Each analysis adapter is for **exactly one grammar**. Multiple analyses
can target the same grammar, but each is explicitly bound to one.
The `K` type parameter on `AnalysisDecl<K>` links them at the type level.
The grammar re-export from the adapter barrel makes the binding discoverable.

New analysis adapters MUST:
1. Import grammar types directly from the grammar adapter barrel
2. Re-export grammar, grammar kind type, and KindToNode from their own barrel
3. Use concrete node types in domain types (not `unknown`)
4. Type predicate sets with the grammar's kind union
5. See ADR-001 for rationale
