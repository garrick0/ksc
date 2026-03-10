/**
 * Evaluation composition root: KindScript program creation.
 *
 * Wires adapters to ports:
 *   - Grammar adapter:  specs/ts-ast/grammar/       → Grammar<TSNodeKind>
 *   - Frontend adapter: specs/ts-ast/frontend/      → Frontend<ts.Program, KSProgram>
 *   - Analysis adapter: specs/ts-ast/kind-checking/  → AnalysisSpec<TSNodeKind, KSCProjections>
 *   - Dispatch adapter: generated/ts-ast/kind-checking/ → DispatchConfig
 *
 * Pipeline:
 *   1. Frontend conversion  (TS AST → KS AST via frontend adapter)
 *   2. Attribute evaluation (KS AST → definitions + diagnostics via evaluator engine)
 */

import ts from 'typescript';
import type { KSProgramInterface } from './types.js';
import type { KindScriptConfig } from './config.js';

// Adapters — pluggable spec implementations
import { frontend } from '../../../specs/ts-ast/frontend/convert.js';
import { grammar } from '../../../specs/ts-ast/grammar/index.js';
import { analysisSpec } from '../../../specs/ts-ast/kind-checking/spec.js';
import { dispatchConfig } from '../../../generated/ts-ast/kind-checking/dispatch.js';

// Generic machinery — ports
import { wireEvaluator } from '../../../evaluator/index.js';
import { buildDepGraph } from '../../../analysis/index.js';

/** The evaluator — wired from grammar + spec + generated dispatch (validates dispatch automatically). */
const evaluator = wireEvaluator({
  grammar,
  spec: analysisSpec,
  dispatch: dispatchConfig,
});

/** Dep graph — computed once from the spec (not generated, not part of evaluator). */
const depGraph = buildDepGraph(analysisSpec.attrs);

/**
 * Create a KindScript program from root file names and optional config.
 */
export function createProgram(
  rootNames: string[],
  config?: KindScriptConfig,
  options?: ts.CompilerOptions,
): KSProgramInterface {
  const tsProgram = ts.createProgram(rootNames, options ?? {});
  return createProgramFromTSProgram(tsProgram, config);
}

/**
 * Create a KindScript program from an existing ts.Program.
 */
export function createProgramFromTSProgram(
  tsProgram: ts.Program,
  config?: KindScriptConfig,
): KSProgramInterface {
  const depth = config?.analysisDepth ?? 'check';
  const ksTree = frontend.convert(tsProgram, depth);
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
