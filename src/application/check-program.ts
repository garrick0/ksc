/**
 * Use case: Check program — parse TS, convert to KS AST, evaluate, project results.
 *
 * Pure function — receives all dependencies via the deps parameter.
 * Pre-wired versions are exported from the barrel (index.ts).
 */

import ts from 'typescript';
import type { KSProgramInterface, CheckDeps, CheckProjections, KindScriptConfig } from './types.js';

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
