/**
 * Use case: Parse only — convert TS AST to KS AST without evaluation.
 *
 * Pure function — receives the translator via parameter.
 * Pre-wired version is exported from the barrel (index.ts).
 */

import ts from 'typescript';
import type { ASTNode, AstTranslatorPort } from '../index.js';
import type { AnalysisDepth } from '@ksc/types';

/**
 * Parse-only pipeline — converts TS AST to KS AST without attribute evaluation.
 *
 * @param translator  The AST translator to use.
 * @param depth  How much TS analysis to perform: 'parse' (syntax only),
 *               'bind' (symbol flags), or 'check' (full type info). Default: 'parse'.
 */
export function parseOnly<R extends ASTNode = ASTNode>(
  translator: AstTranslatorPort<ts.Program, R, AnalysisDepth>,
  rootNames: string[],
  options?: ts.CompilerOptions,
  depth?: AnalysisDepth,
): { root: R } {
  const tsProgram = ts.createProgram(rootNames, options ?? {});
  return translator.convert(tsProgram, depth);
}
