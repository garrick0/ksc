/**
 * Runtime analysis port contracts — interfaces consumed by the evaluator.
 *
 * Ports defined here:
 *   - AnalysisProjections<P>  — what an analysis provides at runtime (projections + setup)
 *
 * These are the runtime counterpart to AnalysisDecl<K> (in @kindscript/core-codegen),
 * which is the codegen-time declaration. The two are independent — neither imports
 * from the other.
 */

import type { Ctx } from './ctx.js';

// ── Analysis projections (runtime concern) ──

/**
 * What an analysis provides at runtime for the evaluator.
 *
 * Consumed by createEvaluator / composition roots. Lightweight — no equation
 * functions, no pivot machinery.
 */
export interface AnalysisProjections<P extends Record<string, unknown> = Record<string, unknown>> {
  /** Projection functions: extract final results from root. Typed by P for end-to-end type safety. */
  projections: { [Key in keyof P]: (root: Ctx) => P[Key] };
  /** Optional setup function called before each evaluation (e.g., resetCounter). */
  setup?: () => void;
}
