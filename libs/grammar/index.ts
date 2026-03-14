/**
 * Grammar module barrel — ports, utilities, and re-exports.
 *
 * Ports:
 *   Grammar<K>         — what a grammar definition provides
 *   AstTranslatorPort<I, R, O> — what a source-language converter provides
 *   ASTNode            — base shape for all AST nodes
 *   FieldDef           — field metadata contract
 *
 * Adapter-specific types (KSNode, KindToNode) are in adapters/grammars/<target>/index.ts.
 */

// ── Application: port interfaces ──

export type { ASTNode } from './application/ports/ASTNode.js';
export type { FieldDef, ChildFieldDef, PropFieldDef } from './application/ports/FieldDef.js';
export type { Grammar } from './application/ports/Grammar.js';
export type { AstTranslatorPort } from './application/ports/AstTranslatorPort.js';

// ── Domain: base types ──

export type {
  KSNodeBase,
  KSCommentRange,
} from './domain/base-types.js';

// ── Domain: schema shapes ──

export type {
  NodeDefShape,
  SumTypeDefShape,
  FieldDescShape,
} from './domain/schema-shapes.js';

// ── Domain: shared data types ──

export type { AttributeDepGraph } from './domain/dep-graph-types.js';

// ── Application: metadata computation ──

export {
  computeFieldDefs,
  computeAllKinds,
  computeSumTypeMembers,
  computeKindMembership,
  createTypeGuard,
  propagateSumTypeFields,
  createGrammarMetadata,
} from './application/metadata.js';
export type { GrammarMetadata } from './application/metadata.js';

// ── Application: tree operations ──

export {
  getChildren,
  createNode,
  nodeToJSON,
  nodeFromJSON,
  treeToJSON,
  treeFromJSON,
} from './application/tree-ops.js';
export type { JSONNode, JSONTree } from './application/tree-ops.js';

// ── Application: tree serialization ──

export { serializeNode } from './application/serialize-tree.js';
export type { SerializedNode, SerializedFieldEntry, SerializeNodeOptions } from './application/serialize-tree.js';

// ── Application: parse-only pipeline ──

export { parseOnly } from './application/parse-only.js';
