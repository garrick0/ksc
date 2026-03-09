/**
 * The KindScript Program object.
 *
 * Top-level coordinator: creates the TypeScript program, converts to
 * KSC AST, and evaluates binder + checker via the compiled evaluator.
 */

import ts from 'typescript';
import type { KSProgramInterface } from './types.js';
import type { KindScriptConfig } from './config.js';
import { buildKSTree } from '../../generated/ts-ast/grammar/convert.js';
import { evaluate } from '../../generated/ts-ast/kind-checking/evaluator.js';

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
  const ksTree = buildKSTree(tsProgram, depth);
  const { definitions, diagnostics, getDepGraph } = evaluate(ksTree.root);

  return {
    getRootFileNames: () => ksTree.root.compilationUnits.map(cu => cu.fileName),
    getCompilationUnits: () => ksTree.root.compilationUnits,
    getKindDefinitions: () => definitions,
    getDiagnostics: () => diagnostics,
    getKSTree: () => ksTree,
    getAttributeDepGraph: getDepGraph,
  };
}
