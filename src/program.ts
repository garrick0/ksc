/**
 * The KindScript Program object.
 *
 * Top-level coordinator: creates the TypeScript program, converts to
 * KSC AST, and evaluates binder + checker via the compiled evaluator.
 */

import ts from 'typescript';
import type { KSProgramInterface } from './pipeline/types.js';
import type { KindScriptConfig } from './api/config.js';
import { buildKSTree } from '../ast-schema/generated/convert.js';
import { evaluate } from '../ksc-generated/evaluator.js';

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
  const ksTree = buildKSTree(tsProgram);
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
