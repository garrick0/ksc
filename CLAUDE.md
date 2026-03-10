# KindScript — Developer Guide

## Architecture Overview

KindScript is a **declarative attribute grammar system** with a **ports-and-adapters**
architecture. Generic machinery (ports) lives in `grammar/`, `analysis/`, `evaluator/`.
Pluggable specs (adapters) live in `specs/`. Composition roots in `app/` wire them together.

- **Ports file** (`ports.ts`): single discoverable entry point listing all contracts
- **Grammar port** (`grammar/derive.ts`): `Grammar<K>`, `ASTNode`, `FieldDef`, `Frontend<I,R,O>`
- **Analysis port** (`analysis/types.ts`): `AnalysisSpec<K,P>`, `AttrDecl<K>`, `CodegenTarget<K,P>`
- **Evaluator port** (`evaluator/types.ts`): `DispatchConfig`, `EvaluatorConfig<P>`, `EvaluationTarget<K,P>`, `EvaluationPipeline<I,R,P,O>`, `EvaluationResult<P>`, `TypedAGNode<M>`
- **Context port** (`analysis/ctx.ts`): `Ctx`, `KindCtx<N>`

There is **no grammar codegen** — grammar types are derived at the type level, runtime
metadata is computed by pure utility functions, and converters are hand-written.

## Ports and Adapters

```
PORTS (contracts — generic machinery, no spec imports)
├── Grammar<K>             grammar/derive.ts     — what a grammar provides
├── Frontend<I, R, O>      grammar/derive.ts     — what a converter provides
├── AnalysisSpec<K, P>     analysis/types.ts     — what an analysis provides
├── CodegenTarget<K, P>    analysis/types.ts     — what a codegen root provides
├── DispatchConfig         evaluator/types.ts    — what generated dispatch provides
├── Ctx / KindCtx<N>       analysis/ctx.ts       — how equations access the tree
├── EvaluatorConfig<P>     evaluator/types.ts    — how the evaluator is assembled
├── EvaluationTarget<K, P> evaluator/types.ts    — named shape for wireEvaluator
├── EvaluationPipeline<I,R,P,O> evaluator/types.ts — generic two-stage pipeline
├── EvaluationResult<P>    evaluator/types.ts    — projected evaluation output
└── TypedAGNode<M>         evaluator/types.ts    — type-safe attribute access

ADAPTERS (implementations — pluggable specs)
├── specs/ts-ast/grammar/       → Grammar<TSNodeKind>
├── specs/ts-ast/frontend/      → Frontend<ts.Program, KSProgram, AnalysisDepth>
├── specs/ts-ast/kind-checking/ → AnalysisSpec<TSNodeKind, KSCProjections>
├── specs/mock/grammar/         → Grammar<MockKind>
└── specs/mock/mock-analysis/   → AnalysisSpec<MockKind, MockProjections>

COMPOSITION ROOTS (app/ — wire adapters to ports)
├── app/user-api/          evaluation: grammar + frontend + spec + dispatch → results
├── app/analysis-codegen/  codegen: CodegenTarget → generated dispatch
└── app/cli/               CLI: uses user-api pipeline
```

The K type parameter links grammar and spec at composition boundaries —
TypeScript prevents mismatched grammar/spec pairs.

## Directory Structure

```
ports.ts                          All port interfaces re-exported from one place

specs/                            Adapters — pluggable spec implementations
  ts-ast/                         TypeScript AST target
    grammar/                      Adapter: Grammar<TSNodeKind> (364 node kinds)
      nodes.ts                    Node kind declarations (as const satisfies, plain objects)
      index.ts                    Spec-level barrel — grammar object, concrete types, runtime metadata
    frontend/                     Adapter: Frontend<ts.Program, KSProgram, AnalysisDepth>
      convert.ts                  Hand-written schema-driven converter + frontend object
      helpers.ts                  TS-specific extractor helpers (pure — ConvertContext passed in)
    kind-checking/                Adapter: AnalysisSpec<TSNodeKind, KSCProjections>
      types.ts                    Domain types (KindDefinition, Diagnostic, PropertySet, Kind<R>)
      equations.ts                All equation functions (per-kind equations for each attr)
      spec.ts                     AnalysisSpec (8 attrs: 4 structural + 2 parameterized + allViolations + nodeCount)
  mock/                           Mock target (testing)
    grammar/                      Adapter: Grammar<MockKind> (5 node kinds)
      nodes.ts, index.ts
    mock-analysis/                Adapter: AnalysisSpec<MockKind, MockProjections> (1 attr)
      spec.ts

grammar/                          Port: Grammar type system + runtime utilities (fully generic)
  derive.ts                       Port interfaces: Grammar<K>, Frontend<I,R,O>, ASTNode, FieldDef
  schema-utils.ts                 Machinery: computeFieldDefs(), getChildren(), createNode(), serialization
  index.ts                        Barrel: ports + machinery

analysis/                         Port: Analysis machinery + compilation (generic, no spec imports)
  types.ts                        Port interfaces: AnalysisSpec, AttrDecl, CodegenTarget, GeneratedImports
  ctx.ts                          Port interface: Ctx, KindCtx<N>
  compile.ts                      Machinery: compileAnalysis(Grammar, AnalysisSpec) → CompiledAnalyzer
  validate.ts                     Machinery: spec validation (attr dep consistency)
  pivot.ts                        Machinery: pivotToAttrCentric() — reshapes equation format

evaluator/                        Port: Hand-written AG evaluator engine (generic, no spec imports)
  engine.ts                       Machinery: AGNode class + createEvaluator() + wireEvaluator()
  types.ts                        Port interfaces: DispatchConfig, EvaluatorConfig, EvaluationTarget, EvaluationPipeline, EvaluationResult, TypedAGNode
  index.ts                        Barrel: ports + machinery

app/                              Composition roots (three isolated directories, no cross-imports)
  cli/                            ksc CLI (check, init, watch)
    cli.ts                        CLI entry point
  user-api/                       Evaluation composition root (npm package)
    index.ts                      Public API barrel (re-exports)
    lib/                          Runtime library
      program.ts                  Wires: grammar + frontend + spec + dispatch → EvaluationPipeline
      parse.ts                    parseOnly (TS → KS AST, no analysis)
      config.ts                   KindScriptConfig, defineConfig
      types.ts                    KSProgramInterface (concrete, TS-specific)
  analysis-codegen/               Codegen composition roots
    ts-kind-checking.ts           CodegenTarget<TSNodeKind> → generated/ts-ast/kind-checking/
    mock.ts                       CodegenTarget<MockKind> → generated-mock/mock/mock-analysis/
    lib/pipeline.ts               CodegenPipeline (extends CodegenTarget), runCodegenCLI

generated/                        Machine-generated output (never edit)
  ts-ast/                         Output grouped by grammar target
    kind-checking/                Analysis codegen output (dispatch.ts, attr-types.ts)
```

## Spec-Level Barrels

Each grammar has a spec-level barrel (`specs/<target>/grammar/index.ts`) that:
1. Imports raw `NODES` and `SUM_TYPES` from `nodes.ts`
2. Propagates sum type fields (e.g., Expression.typeString → all member kinds)
3. Exports `grammar: Grammar<K>` — the port-conforming grammar object
4. Exports concrete types: `KSNode`, `KindToNode`, specific node interfaces
5. Exports utility functions: `getChildren()`, `createNode()`, serialization

Each frontend has a `frontend: Frontend<Input, Root, Opts>` export for the composition root.

## Analysis Codegen

Analysis codegen is the **only codegen** in the system:

```
app/analysis-codegen/ts-kind-checking.ts → generated/ts-ast/kind-checking/
app/analysis-codegen/mock.ts             → generated-mock/mock/mock-analysis/
```

### Adding a new analysis composition root

**Codegen root** (`app/analysis-codegen/<name>.ts`):
1. Import `grammar` from `specs/<target>/grammar/index.ts`
2. Import `analysisSpec` from `specs/<target>/<analysis>/spec.ts`
3. Build a `CodegenTarget<K, P>` with grammar + spec + outputDir + generatedImports
4. Call `runCodegenCLI({ ...target, callerFilePath: __filename })`

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

### Frontend<Input, Root, Opts> — what a converter provides

```typescript
interface Frontend<Input = unknown, Root extends ASTNode = ASTNode, Opts = unknown> {
  convert(input: Input, opts?: Opts): { root: Root };
}
```

### AnalysisSpec<K, P> — what an analysis provides

```typescript
interface AnalysisSpec<K extends string = string, P extends Record<string, unknown> = Record<string, unknown>> {
  attrs: AttrDecl<K>[];
  projections: { [Key in keyof P]: (root: Ctx) => P[Key] };
  typeImports?: (paths: ImportPaths) => string[];
  setup?: () => void;
}
```

### CodegenTarget<K, P> — what a codegen root provides

```typescript
interface CodegenTarget<K extends string = string, P extends Record<string, unknown> = Record<string, unknown>> {
  grammar: Grammar<K>;
  spec: AnalysisSpec<K, P>;
  outputDir: string;
  generatedImports: GeneratedImports;
}
```

### DispatchConfig — what generated dispatch provides

```typescript
type DispatchConfig = Record<string, DispatchEntry>;
// DispatchEntry = SynDispatchEntry | InhDispatchEntry | CollectionDispatchEntry
```

## Adapters

### Current adapters

| Adapter | Port | Location |
|---|---|---|
| TS AST grammar | `Grammar<TSNodeKind>` | `specs/ts-ast/grammar/index.ts` |
| TS AST frontend | `Frontend<ts.Program, KSProgram, AnalysisDepth>` | `specs/ts-ast/frontend/convert.ts` |
| Kind-checking analysis | `AnalysisSpec<TSNodeKind, KSCProjections>` | `specs/ts-ast/kind-checking/spec.ts` |
| Mock grammar | `Grammar<MockKind>` | `specs/mock/grammar/index.ts` |
| Mock analysis | `AnalysisSpec<MockKind, MockProjections>` | `specs/mock/mock-analysis/spec.ts` |

### Adding a new adapter

**New grammar** (e.g., Python AST):
1. Create `specs/python-ast/grammar/nodes.ts` — `NODES` and `SUM_TYPES` as `as const satisfies` objects
2. Create `specs/python-ast/grammar/index.ts` — spec-level barrel with `grammar: Grammar<PyNodeKind>`
3. Create `specs/python-ast/frontend/convert.ts` — `frontend: Frontend<PyInput, KSProgram, PyOpts>`
4. The `grammar/` machinery is reused — zero changes needed

**New analysis** (e.g., complexity analysis over TS AST):
1. Create `specs/ts-ast/complexity/spec.ts` with `analysisSpec: AnalysisSpec<TSNodeKind, ComplexityProjections>`
2. Create `specs/ts-ast/complexity/types.ts` for analysis-specific vocabulary
3. Create `specs/ts-ast/complexity/equations.ts` — equation functions with `withDeps()`
4. Create `app/analysis-codegen/complexity.ts` — `CodegenTarget<TSNodeKind, ComplexityProjections>`
5. The `analysis/` machinery is reused — it's fully generic

## Codegen Commands

```bash
npm run codegen                                          # analysis codegen (full pipeline)
npm run codegen:analysis                                 # analysis only (same as codegen)

npx tsx app/analysis-codegen/ts-kind-checking.ts         # kind-checking analysis
npx tsx app/analysis-codegen/mock.ts                     # mock analysis (testing)
```

## Testing

```bash
npx vitest run                      # all tests
npx vitest run --testTimeout=30000  # with timeout for slow fixtures
npx vitest run test/kind-checking.test.ts # single file
```

## Key Conventions

- Grammar schemas use plain `as const satisfies` objects — no builder DSL, no codegen
- AG attribute directions: `syn` (synthesized), `inh` (inherited), `collection`
- AttrDecl is a discriminated union: SynAttr (default + equations), InhAttr (rootValue + parentEquations), CollectionAttr (init + combine)
- AttrDecl fields use `AttrExpr` (Function | null | number | boolean | CodeLiteral) — not strings
- `withDeps(deps, fn)` attaches dep metadata to equation functions; `collectDepsForAttr(attr)` reads it
- `code(expr)` wraps raw code strings as CodeLiteral; equation functions are direct Function references
- Equation functions use standardized signatures: `(ctx: Ctx)` or `(ctx: Ctx, param: ParamType)`
- Parameterized attributes (JastAdd-style): optional `parameter: { name, type }` on any attr, generates Map-based caching
- Equations: syn equations are Function refs, inh parentEquations return `T | undefined` (undefined = copy-down)
- Generated files have `AUTO-GENERATED` headers — never edit them manually
- `generated/` is committed (not gitignored) so consumers don't need codegen
- `generated-mock/` is gitignored (test artifact only)
- Domain types (`KindDefinition`, `Diagnostic`, `ViolationRule`) live in `specs/`, not `analysis/`
- Projection keys use domain names (`definitions`, `diagnostics`), not compiler-pass names
- `KSNodeBase` has `[key: string]: unknown` index signature for structural cast compatibility
- Generated dispatch functions use `ctx as unknown as KindCtx<...>` for per-kind equation casts
- Evaluator is hand-written (`evaluator/engine.ts`), dispatch functions are generated (`generated/*/dispatch.ts`)
- Port interfaces are re-exported from `ports.ts` for discoverability
- Adapters use explicit type annotations (e.g., `grammar: Grammar<TSNodeKind>`) for conformance
- Composition roots use `CodegenTarget<K, P>` to pair grammar + spec with K-linking
- Composition roots use `EvaluationTarget<K, P>` for `wireEvaluator` input (K-linked)
- `EvaluationPipeline<I,R,P,O>` and `EvaluationResult<P>` are generic ports in `evaluator/types.ts`
- `buildKSTree` is internal to the frontend adapter — consumers use `frontend.convert()`
