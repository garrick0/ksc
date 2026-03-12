/**
 * Use case: Check program — parse TS, convert to KS AST, evaluate, project results.
 *
 * Pure function — receives all dependencies via the deps parameter.
 * Pre-wired versions are exported from the barrel (index.ts).
 */

import ts from 'typescript';
import type { KSProgramInterface, CheckDeps, CheckProjections, KindScriptConfig } from './types.js';
import { setProtobufCheckingEnabled } from '../adapters/analysis/spec/ts-kind-checking/equations/protobuf.js';

/** Apply config-driven toggles before evaluation. */
function applyConfig(config?: KindScriptConfig): void {
  setProtobufCheckingEnabled(config?.protobuf?.enabled ?? false);
}

/** Create a KindScript program from file paths. */
export function createProgram<M = Record<string, unknown>, P extends CheckProjections = CheckProjections>(
  deps: CheckDeps<M, P>,
  rootNames: string[],
  config?: KindScriptConfig,
  options?: ts.CompilerOptions,
): KSProgramInterface {
  const tsProgram = ts.createProgram(rootNames, options ?? {});
  return createProgramFromTSProgram(deps, tsProgram, config);
}

/** Create a KindScript program from an existing TypeScript program. */
export function createProgramFromTSProgram<M = Record<string, unknown>, P extends CheckProjections = CheckProjections>(
  deps: CheckDeps<M, P>,
  tsProgram: ts.Program,
  config?: KindScriptConfig,
): KSProgramInterface {
  applyConfig(config);
  const depth = config?.analysisDepth ?? 'check';
  const ksTree = deps.translator.convert(tsProgram, depth);
  const { definitions, diagnostics } = deps.evaluator.evaluate(ksTree.root);

  return {
    getRootFileNames: () => ksTree.root.compilationUnits.map(cu => cu.fileName),
    getCompilationUnits: () => ksTree.root.compilationUnits,
    getKindDefinitions: () => definitions,
    getDiagnostics: () => diagnostics,
    getKSTree: () => ksTree,
    getAttributeDepGraph: () => deps.depGraph,
  };
}
