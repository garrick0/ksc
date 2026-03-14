/**
 * Mock grammar barrel — Adapter: Grammar<MockKind>
 *
 * Implements the Grammar port for the mock test grammar (5 node kinds).
 */

import type { ASTNode, KSNodeBase, ChildFieldDef, PropFieldDef, FieldDef, Grammar, GrammarMetadata, SumTypeDefShape } from '@ksc/grammar';
import {
  createGrammarMetadata,
  getChildren as getChildrenImpl,
  createNode as createNodeImpl,
} from '@ksc/grammar';
import { NODES as NODES_RAW, SUM_TYPES, type MockKind } from './nodes.js';

// Re-export base types
export type { ASTNode, KSNodeBase, ChildFieldDef, PropFieldDef, FieldDef, Grammar, GrammarMetadata, AttributeDepGraph } from '@ksc/grammar';
export { type MockKind } from './nodes.js';

// ═══════════════════════════════════════════════════════════════════════
// Grammar metadata factory
// ═══════════════════════════════════════════════════════════════════════

/** Create all runtime metadata for the mock grammar. */
export function createMockGrammarMetadata(): GrammarMetadata<typeof NODES_RAW> {
  return createGrammarMetadata(NODES_RAW, SUM_TYPES as Record<string, SumTypeDefShape>);
}

/** Create the mock grammar object (Grammar port implementation). */
export function createMockGrammar(): Grammar<MockKind> {
  const metadata = createMockGrammarMetadata();
  return {
    fieldDefs: metadata.fieldDefs,
    allKinds: metadata.allKinds as ReadonlySet<MockKind>,
    fileContainerKind: 'MockProgram' as MockKind,
    fileNameField: 'fileName',
    sumTypeMembers: metadata.sumTypeMembers,
    sumTypeMembership: metadata.sumTypeMembership,
  };
}

// ── Deprecated singletons (moved to composition roots or local factories) ──

const _grammar = createMockGrammarMetadata();

export const fieldDefs = _grammar.fieldDefs;
export const allKinds = _grammar.allKinds;
export const sumTypeMembers = _grammar.sumTypeMembers;
export const sumTypeMembership = _grammar.sumTypeMembership;

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
