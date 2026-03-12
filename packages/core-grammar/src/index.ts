/**
 * Grammar module barrel — ports and runtime utilities.
 *
 * Ports:
 *   Grammar<K>         — what a grammar definition provides
 *   AstTranslatorPort<I, R, O> — what a source-language converter provides
 *   ASTNode            — base shape for all AST nodes
 *   FieldDef           — field metadata contract
 *
 * Adapter-specific types (KSNode, KindToNode) are in adapters/grammar/<target>/index.ts.
 */

// Port interfaces
export type {
  ASTNode,
  ChildFieldDef,
  PropFieldDef,
  FieldDef,
  Grammar,
  AstTranslatorPort,
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

// Tree serialization (presentation-friendly format)
export { serializeNode } from './serialize-tree.js';
export type { SerializedNode, SerializedFieldEntry, SerializeNodeOptions } from './serialize-tree.js';

// Shared data types
export type { AttributeDepGraph } from './dep-graph-types.js';
