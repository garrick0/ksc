/**
 * Parse-only pipeline — TypeScript source → KS AST, no analysis.
 */

import ts from 'typescript';
import { frontend, type KSTree } from '../../../specs/ts-ast/frontend/convert.js';

/**
 * Parse TypeScript files into a KS AST tree without running analysis.
 */
export function parseOnly(
  rootNames: string[],
  options?: ts.CompilerOptions,
): KSTree {
  const tsProgram = ts.createProgram(rootNames, options ?? {});
  return frontend.convert(tsProgram);
}
