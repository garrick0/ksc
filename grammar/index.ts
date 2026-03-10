/**
 * Grammar module barrel — ports and runtime utilities.
 *
 * Ports:
 *   Grammar<K>         — what a grammar definition provides
 *   Frontend<I, R, O>  — what a source-language converter provides
 *   ASTNode            — base shape for all AST nodes
 *   FieldDef           — field metadata contract
 *
 * Spec-specific types (KSNode, KindToNode) are in specs/<target>/grammar/index.ts.
 */

// Port interfaces
export type {
  ASTNode,
  ChildFieldDef,
  PropFieldDef,
  FieldDef,
  Grammar,
  Frontend,
} from './ports.js';

// Grammar-level base types
export type {
  KSNodeBase,
  KSCommentRange,
} from './base-types.js';

// Schema validation shapes
export type {
  NodeDefShape,
  SumTypeDefShape,
  FieldDescShape,
} from './schema-shapes.js';

// Metadata computation utilities
export {
  computeFieldDefs,
  computeAllKinds,
  computeSumTypeMembers,
  computeKindMembership,
  createTypeGuard,
  propagateSumTypeFields,
  createGrammarMetadata,
} from './metadata.js';
export type { GrammarMetadata } from './metadata.js';

// Tree operation utilities
export {
  getChildren,
  createNode,
  nodeToJSON,
  nodeFromJSON,
  treeToJSON,
  treeFromJSON,
} from './tree-ops.js';
export type { JSONNode, JSONTree } from './tree-ops.js';
