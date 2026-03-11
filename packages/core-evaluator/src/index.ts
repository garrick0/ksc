/**
 * Evaluator module barrel — ports, AG engine, and runtime analysis interfaces.
 *
 * Ports:
 *   DispatchConfig          — what generated dispatch provides
 *   EvaluatorConfig<P>      — how the evaluator is assembled
 *   TypedAGNode<M>          — type-safe attribute access
 *   Ctx / KindCtx           — equation function context
 *   AnalysisProjections<P>  — what an analysis provides at runtime
 *
 * Machinery:
 *   createEvaluator     — factory from EvaluatorConfig
 */

export { createEvaluator, createEvaluatorFromTarget, validateDispatch } from './engine.js';
export type { Evaluator } from './engine.js';
export type {
  DispatchConfig,
  DispatchEntry,
  SynDispatchEntry,
  InhDispatchEntry,
  CollectionDispatchEntry,
  EvaluatorConfig,
  EvaluationTarget,
  AGNodeInterface,
  TypedAGNode,
} from './ports.js';
export type { Ctx, KindCtx } from './ctx.js';
export type { AnalysisProjections } from './analysis-ports.js';
