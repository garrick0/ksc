/**
 * Runtime analysis port contracts — interfaces consumed by the evaluator.
 *
 * Ports defined here:
 *   - AnalysisProjections<M, P>  — what an analysis provides at runtime (projections + setup)
 *
 * These are the runtime counterpart to AnalysisDecl<K> (in @kindscript/core-codegen),
 * which is the codegen-time declaration. The two are independent — neither imports
 * from the other.
 */

import type { TypedAGNode } from './ports.js';

// ── Analysis projections (runtime concern) ──

/**
 * What an analysis provides at runtime for the evaluator.
 *
 * Consumed by createEvaluator / composition roots. Lightweight — no equation
 * functions, no pivot machinery.
 *
 * M = generated attr map type (e.g., KSCAttrMap) — gives projection functions
 *     type-safe attr() access via TypedAGNode<M> (see ADR-003).
 * P = projection result shape (e.g., KSCProjections).
 */
export interface AnalysisProjections<M = Record<string, unknown>, P extends Record<string, unknown> = Record<string, unknown>> {
  /** Projection functions: extract final results from root. Typed by M for attr access and P for return types. */
  projections: { [Key in keyof P]: (root: TypedAGNode<M>) => P[Key] };
  /** Optional setup function called before each evaluation (e.g., resetCounter). */
  setup?: () => void;
}
