import type { Grammar } from '@ksc/grammar/index.js';
import type { AnalysisDecl } from '../domain/ports.js';
import type { CompiledAnalyzer, GeneratedImports } from '../domain/types.js';
import { planBehavior } from './planning/plan.js';
import { emitAdapters } from './emission/emit.js';

export { planBehavior } from './planning/plan.js';
export { buildDepGraph, validateSpecConsistency } from './planning/plan.js';
export { emitAdapters } from './emission/emit.js';

/**
 * Legacy API: compileAnalysis (wraps Plan + Emit)
 *
 * Takes a declarative analysis specification and produces generated file content.
 */
export function compileAnalysis(
  grammar: Grammar,
  decl: AnalysisDecl,
  opts?: GeneratedImports,
): CompiledAnalyzer {
  const plan = planBehavior(grammar, decl);
  return emitAdapters(plan, opts);
}
