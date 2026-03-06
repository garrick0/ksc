/**
 * @ksc/ag-schema — Schema-first node definitions for attribute grammars.
 *
 * Provides defineNode() as the single source of truth for AST node types,
 * with runtime introspection, type inference, and derived getChildren.
 */

// Builder functions and types
export {
  defineNode,
  defineLeaf,
  child,
  optChild,
  list,
  prop,
} from './define.js';

export type {
  NodeDef,
  NodeSpec,
  ChildSpec,
  OptChildSpec,
  ListSpec,
  PropSpec,
  FieldSpec,
  NodeBase,
  InferNode,
  InferField,
  InferFields,
} from './define.js';

// Schema registry
export { createNodeSchema } from './schema.js';
export type { NodeSchema } from './schema.js';
