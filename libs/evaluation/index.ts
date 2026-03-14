/**
 * Evaluation module barrel — generic runtime only.
 */

export {
  buildTree,
  evaluate,
  validateDispatch,
} from './domain/evaluator-index.js';

export type {
  DispatchConfig,
  DispatchEntry,
  SynDispatchEntry,
  InhDispatchEntry,
  CollectionDispatchEntry,
  AGNodeInterface,
  TypedAGNode,
  BuildTreeArgs,
  EvaluateArgs,
  Ctx,
  KindCtx,
} from './domain/evaluator-index.js';
