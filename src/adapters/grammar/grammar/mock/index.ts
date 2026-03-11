/**
 * Mock grammar barrel — Adapter: Grammar<MockKind>
 *
 * Implements the Grammar port for the mock test grammar (5 node kinds).
 */

import type { ASTNode, KSNodeBase, ChildFieldDef, PropFieldDef, FieldDef, Grammar, GrammarMetadata, SumTypeDefShape } from '@kindscript/core-grammar';
import {
  createGrammarMetadata,
  getChildren as getChildrenImpl,
  createNode as createNodeImpl,
} from '@kindscript/core-grammar';
import { NODES as NODES_RAW, SUM_TYPES, type MockKind } from './nodes.js';

// Re-export base types
export type { ASTNode, KSNodeBase, ChildFieldDef, PropFieldDef, FieldDef, Grammar, GrammarMetadata } from '@kindscript/core-grammar';
export { type MockKind } from './nodes.js';

// ═══════════════════════════════════════════════════════════════════════
// Grammar metadata factory + module-level initialization
// ═══════════════════════════════════════════════════════════════════════

/** Create all runtime metadata for the mock grammar. Testable and re-invocable. */
function createMockGrammar(): GrammarMetadata<typeof NODES_RAW> {
  return createGrammarMetadata(NODES_RAW, SUM_TYPES as Record<string, SumTypeDefShape>);
}

const _grammar = createMockGrammar();

export const fieldDefs = _grammar.fieldDefs;
export const allKinds = _grammar.allKinds;
export const sumTypeMembers = _grammar.sumTypeMembers;
export const sumTypeMembership = _grammar.sumTypeMembership;

/** The mock grammar as a first-class object. */
export const grammar: Grammar<MockKind> = {
  fieldDefs: _grammar.fieldDefs,
  allKinds: _grammar.allKinds as ReadonlySet<MockKind>,
  fileContainerKind: 'MockProgram' as MockKind,
  fileNameField: 'fileName',
  sumTypeMembers: _grammar.sumTypeMembers,
  sumTypeMembership: _grammar.sumTypeMembership,
};

// ═══════════════════════════════════════════════════════════════════════
// Concrete types
// ═══════════════════════════════════════════════════════════════════════

export type KSNode = KSNodeBase & { kind: MockKind };

export type KindToNode = {
  [K in MockKind]: KSNode & { kind: K };
};

// ═══════════════════════════════════════════════════════════════════════
// Derived functions
// ═══════════════════════════════════════════════════════════════════════

export function getChildren(node: KSNode): KSNode[] {
  return getChildrenImpl(node, fieldDefs) as KSNode[];
}

export function createNode<K extends string & MockKind>(
  kind: K,
  fields?: Partial<Record<string, unknown>>,
): KindToNode[K] {
  return createNodeImpl(kind, fields, fieldDefs) as KindToNode[K];
}
