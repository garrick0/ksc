/**
 * Composition root for the dashboard extraction path.
 *
 * Wires the parse-only pipeline (pre-composed translator) and extraction
 * adapter into a single function that produces ASTDashboardData for the SPA.
 *
 * Symmetric with apps/cli/compose/compose-check.ts (evaluation path)
 * and apps/cli/compose/compose-codegen.ts (codegen path).
 */

import type { CompilerOptions } from 'typescript';
import { parseOnly } from '../../src/application/index.js';
import { extractASTData } from '../../src/adapters/grammar/extraction/ts-ast/index.js';
import type { ASTDashboardData } from '../../src/adapters/grammar/extraction/ts-ast/index.js';
import type { AnalysisDepth } from '../../src/api.js';

/** Parse TS files into KS AST and serialize for the dashboard SPA. */
export function extractForDashboard(
  rootFiles: string[],
  compilerOptions: CompilerOptions,
  analysisDepth: AnalysisDepth = 'parse',
): ASTDashboardData {
  const ksTree = parseOnly(rootFiles, compilerOptions, analysisDepth);
  return extractASTData(ksTree, analysisDepth);
}
