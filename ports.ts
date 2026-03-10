/**
 * PORT CONTRACT REGISTRY — compile-time validation only.
 *
 * This file is never imported at runtime. It exists to ensure all port
 * interfaces are correctly exported from their barrel modules. If a barrel
 * export is removed or renamed, this file will fail to compile.
 *
 * This is the single discoverable entry point for the system's architectural
 * boundaries. Each port defines a contract between the generic machinery
 * (grammar/, analysis/, evaluator/) and the pluggable specs (specs/).
 *
 * Architecture:
 *
 *   PORTS (this file)          — contracts
 *   ├── Grammar<K>             — what a grammar provides
 *   ├── AnalysisSpec<K, P>     — what an analysis provides
 *   ├── Frontend<Input, Root, Opts> — what a frontend converter provides
 *   ├── DispatchConfig         — what generated dispatch provides
 *   ├── Ctx / KindCtx<N>       — how equations interact with the tree
 *   ├── EvaluatorConfig<P>     — how the evaluator is assembled
 *   ├── EvaluationTarget<K, P> — what wireEvaluator needs (K-linked)
 *   └── CodegenTarget<K, P>    — how a codegen pipeline is assembled
 *
 *   ADAPTERS (specs/)          — implementations
 *   ├── specs/ts-ast/grammar/  → Grammar<TSNodeKind>
 *   ├── specs/ts-ast/frontend/ → Frontend<ts.Program, KSProgram>
 *   ├── specs/ts-ast/kind-checking/ → AnalysisSpec<TSNodeKind, KSCProjections>
 *   └── specs/mock/            → Grammar<MockKind>, AnalysisSpec<MockKind, MockProjections>
 *
 *   COMPOSITION ROOTS (app/)   — wire adapters to ports
 *   ├── app/user-api/          → evaluation: grammar + frontend + spec + dispatch → results
 *   ├── app/analysis-codegen/  → codegen: grammar + spec → generated dispatch
 *   └── app/cli/               → CLI: uses user-api pipeline
 */

// ═══════════════════════════════════════════════════════════════════════
// Port 1: Grammar — what a grammar definition provides
// ═══════════════════════════════════════════════════════════════════════

export type { Grammar, ASTNode, ChildFieldDef, PropFieldDef, FieldDef } from './grammar/index.js';

// ═══════════════════════════════════════════════════════════════════════
// Port 2: Analysis Spec — what an analysis definition provides
// ═══════════════════════════════════════════════════════════════════════

export type {
  AnalysisSpec,
  AttrDecl,
  SynAttr,
  InhAttr,
  CollectionAttr,
  AttrExpr,
  CodeLiteral,
  ParamDef,
  ImportPaths,
} from './analysis/types.js';

// ═══════════════════════════════════════════════════════════════════════
// Port 3: Frontend — what a source-language converter provides
// ═══════════════════════════════════════════════════════════════════════

export type { Frontend } from './grammar/index.js';

// ═══════════════════════════════════════════════════════════════════════
// Port 4: Dispatch — what generated dispatch provides
// ═══════════════════════════════════════════════════════════════════════

export type {
  DispatchConfig,
  DispatchEntry,
  SynDispatchEntry,
  InhDispatchEntry,
  CollectionDispatchEntry,
} from './evaluator/types.js';

// ═══════════════════════════════════════════════════════════════════════
// Port 5: Equation Context — how equations interact with the AG tree
// ═══════════════════════════════════════════════════════════════════════

export type { Ctx, KindCtx } from './analysis/ctx.js';

// ═══════════════════════════════════════════════════════════════════════
// Port 6: Evaluator — how the evaluator is assembled
// ═══════════════════════════════════════════════════════════════════════

export type {
  EvaluatorConfig,
  EvaluationTarget,
  AGNodeInterface,
  TypedAGNode,
} from './evaluator/types.js';

export type { Evaluator } from './evaluator/engine.js';

// ═══════════════════════════════════════════════════════════════════════
// Port 7: Codegen Target — how a codegen pipeline is assembled
// ═══════════════════════════════════════════════════════════════════════

export type { CodegenTarget, GeneratedImports } from './analysis/types.js';

// ═══════════════════════════════════════════════════════════════════════
// Port 8: Compiled Output — what analysis compilation produces
// ═══════════════════════════════════════════════════════════════════════

export type {
  CompiledAnalyzer,
  CompiledAttrDef,
  GeneratedFile,
  AttributeDepGraph,
} from './analysis/types.js';
