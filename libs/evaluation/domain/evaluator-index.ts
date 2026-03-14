/**
 * Evaluator module barrel — ports, AG engine, and runtime analysis interfaces.
 *
 * Ports:
 *   DispatchConfig          — what generated dispatch provides
 *   TypedAGNode<M>          — type-safe attribute access
 *   Ctx / KindCtx           — equation function context
 *
 * Machinery:
 *   evaluate / buildTree    — direct runtime entry points
 */

export { buildTree, evaluate, validateDispatch } from './engine.js';
export type {
  DispatchConfig,
  DispatchEntry,
  SynDispatchEntry,
  InhDispatchEntry,
  CollectionDispatchEntry,
  AGNodeInterface,
  TypedAGNode,
} from '@ksc/ag-ports';
export type { BuildTreeArgs, EvaluateArgs } from './ports.js';
export type { Ctx, KindCtx } from './ctx.js';
