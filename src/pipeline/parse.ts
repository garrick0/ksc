/**
 * Parse-only pipeline — TypeScript source → KS AST, no binder/checker.
 */

import ts from 'typescript';
import { buildKSTree, type KSTree } from '../../ast-schema/generated/convert.js';

/**
 * Parse TypeScript files into a KS AST tree without running
 * the binder or checker stages.
 */
export function parseOnly(
  rootNames: string[],
  options?: ts.CompilerOptions,
): KSTree {
  const tsProgram = ts.createProgram(rootNames, options ?? {});
  return buildKSTree(tsProgram);
}
