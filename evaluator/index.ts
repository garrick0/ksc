/**
 * Evaluator module barrel — ports and AG engine.
 *
 * Ports:
 *   DispatchConfig          — what generated dispatch provides
 *   EvaluatorConfig<P>      — how the evaluator is assembled
 *   EvaluationTarget<K,P>   — named shape for wireEvaluator input
 *   TypedAGNode<M>          — type-safe attribute access
 *
 * Machinery:
 *   createEvaluator     — factory from EvaluatorConfig
 *   wireEvaluator       — convenience wrapper from EvaluationTarget
 */

export { createEvaluator, wireEvaluator, validateDispatch } from './engine.js';
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
} from './types.js';
